import { db } from '../db';
import { applyRating, createInitialState } from '../algorithms/fsrs';
import { getRule } from '../games/registry';
import { uuid } from '../utils/uuid';
import type {
  Attempt,
  Card,
  ClozeQuestion,
  Question,
  Rating,
  ReadingQuestion,
  Settings,
} from '../types';

const RECORD_VERSION = 1;

function itemList(question: Question): { index: number; wordId: string }[] {
  if (question.type === 'cloze') {
    return (question as ClozeQuestion).content.blanks.map((b) => ({
      index: b.index,
      wordId: b.wordId,
    }));
  }
  return (question as ReadingQuestion).content.questions.map((q) => ({
    index: q.index,
    wordId: q.wordId,
  }));
}

// ===== 单词 =====

export async function addCard(
  input: Partial<Card> & { word: string },
  now: number = Date.now()
): Promise<Card> {
  const card: Card = {
    id: uuid(),
    word: input.word.trim(),
    pos: input.pos ?? '',
    meaning: input.meaning ?? '',
    pronunciation: input.pronunciation ?? '',
    humorExplanation: input.humorExplanation ?? '',
    roots: input.roots ?? '',
    mnemonic: input.mnemonic ?? '',
    examples: Array.isArray(input.examples) ? input.examples : [],
    tags: Array.isArray(input.tags) ? input.tags : [],
    source: input.source ?? 'user_added',
    createdAt: now,
    updatedAt: now,
    schemaVersion: RECORD_VERSION,
  };
  const state = createInitialState(card.id, now);
  await db.transaction('rw', [db.cards, db.reviewStates], async () => {
    await db.cards.add(card);
    await db.reviewStates.add(state);
  });
  return card;
}

export async function updateCard(
  id: string,
  patch: Partial<Omit<Card, 'id' | 'createdAt' | 'schemaVersion' | 'source'>>,
  now: number = Date.now()
): Promise<void> {
  await db.cards.update(id, { ...patch, updatedAt: now });
}

export async function deleteCard(id: string, now: number = Date.now()): Promise<void> {
  await db.cards.where(':id').equals(id).modify({ deletedAt: now });
}

/** 撤销新增：真实删除（卡片 + 复习状态）。仅用于最近一次录入的可撤销。 */
export async function hardDeleteCard(id: string): Promise<void> {
  await db.transaction('rw', [db.cards, db.reviewStates], async () => {
    await db.cards.delete(id);
    await db.reviewStates.delete(id);
  });
}

// ===== 复习状态 =====

export async function rateCard(
  cardId: string,
  rating: Rating,
  targetRetention: number,
  now: number = Date.now()
): Promise<void> {
  const card = await db.cards.get(cardId);
  if (!card || card.deletedAt) return;
  let state = await db.reviewStates.get(cardId);
  if (!state) state = createInitialState(cardId, now);
  const next = applyRating(state, rating, now, targetRetention);
  await db.reviewStates.put(next);
}

// ===== 刷题 =====

export interface QuestionAttemptEntry {
  question: Question;
  answer: Record<number, string>;
  durationMs: number;
}

export async function recordQuestionAttempts(
  entries: QuestionAttemptEntry[],
  targetRetention: number,
  now: number = Date.now()
): Promise<void> {
  const attempts: Attempt[] = [];
  const ratingByWord = new Map<string, Rating>();

  for (const entry of entries) {
    const { question, answer, durationMs } = entry;
    const rule = getRule(question.type);
    const grade = rule.grade(question, answer);
    const items = itemList(question);

    attempts.push({
      id: uuid(),
      questionId: question.id,
      answers: items.map((it) => ({
        index: it.index,
        answer: typeof answer[it.index] === 'string' ? answer[it.index] : '',
        isCorrect: grade.perItem[it.index] ?? false,
        wordId: it.wordId,
      })),
      isCorrect: grade.isCorrect,
      durationMs,
      createdAt: now,
      schemaVersion: RECORD_VERSION,
    });

    for (const [wordId, r] of Object.entries(grade.wordRatings)) {
      const prev = ratingByWord.get(wordId);
      ratingByWord.set(wordId, (prev ? Math.min(prev, r) : r) as Rating);
    }
  }

  await db.transaction('rw', [db.cards, db.reviewStates, db.attempts], async () => {
    for (const wordId of [...ratingByWord.keys()]) {
      const card = await db.cards.get(wordId);
      if (!card || card.deletedAt) {
        ratingByWord.delete(wordId);
        continue;
      }
      let state = await db.reviewStates.get(wordId);
      if (!state) state = createInitialState(wordId, now);
      const rating = ratingByWord.get(wordId) as Rating;
      const next = applyRating(state, rating, now, targetRetention);
      await db.reviewStates.put(next);
    }
    await db.attempts.bulkAdd(attempts);
  });
}

export async function addQuestion(question: Question): Promise<void> {
  await db.questions.add(question);
}

export async function addAttempt(attempt: Attempt): Promise<void> {
  await db.attempts.add(attempt);
}

// ===== 设置 / 数据管理 =====

export async function saveSettings(settings: Settings): Promise<void> {
  await db.settings.put(settings);
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.cards, db.reviewStates, db.questions, db.attempts], async () => {
    await db.cards.clear();
    await db.reviewStates.clear();
    await db.questions.clear();
    await db.attempts.clear();
  });
}