import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { db } from '../db';
import { generateQuestion, isAIError } from '../services/ai';
import { addQuestion, recordQuestionAttempts } from '../services/mutations';
import { snapshotQueue } from '../services/queue';
import { getRule } from '../games/registry';
import { isAIConfigured, useSettings } from './settingsStore';
import { uuid } from '../utils/uuid';
import type {
  Card,
  ClozeQuestion,
  Question,
  QuestionDraft,
  QuestionType,
  ReadingQuestion,
} from '../types';

export type PracticeStatus = 'idle' | 'new-rule' | 'new-count' | 'generating' | 'playing' | 'done';
export type PracticeMode = 'new' | 'existing';

export interface QuestionResultEntry {
  questionId: string;
  correctCount: number;
  totalCount: number;
  isCorrect: boolean;
  durationMs: number;
}

export interface PracticeResult {
  perQuestion: QuestionResultEntry[];
  correctCount: number;
  totalCount: number;
  questionCount: number;
}

function friendlyMessage(e: unknown): string {
  if (e instanceof Error && isAIError(e)) return e.message;
  if (e instanceof Error) return `操作失败：${e.message}`;
  return '操作失败，请重试。';
}

function toQuestion(ruleId: QuestionType, draft: QuestionDraft, words: Card[]): Question {
  const base = {
    id: uuid(),
    type: ruleId,
    gameRule: ruleId,
    wordIds: [...new Set(words.map((w) => w.id))],
    explanation: draft.explanation,
    highlightedWords: draft.highlightedWords,
    difficulty: draft.difficulty,
    source: 'ai_generated' as const,
    createdAt: Date.now(),
    schemaVersion: 1,
  };
  if (ruleId === 'cloze') {
    const q: ClozeQuestion = {
      ...base,
      type: 'cloze',
      content: draft.content as ClozeQuestion['content'],
      translation: draft.translation,
    };
    return q;
  }
  const q: ReadingQuestion = {
    ...base,
    type: 'reading',
    content: draft.content as ReadingQuestion['content'],
    translation: draft.translation ?? '',
  };
  return q;
}

interface GameStoreState {
  status: PracticeStatus;
  mode: PracticeMode | null;
  ruleId: QuestionType | null;
  count: number;
  presetId: string | null;
  questions: Question[];
  currentIndex: number;
  answers: Record<string, Record<number, string>>;
  timedAt: Record<string, number>;
  startedAt: number;
  generating: boolean;
  loadingExisting: boolean;
  error: string | null;
  result: PracticeResult | null;

  chooseRule(ruleId: QuestionType): void;
  enterNew(): void;
  setCount(count: number): void;
  setPreset(id: string | null): void;
  startNew(): Promise<void>;
  startExisting(): Promise<void>;
  answer(qid: string, index: number, value: string): void;
  goTo(index: number): void;
  submit(): Promise<void>;
  clearError(): void;
  reset(): void;
}

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      mode: null,
      ruleId: null,
      count: 15,
      presetId: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      timedAt: {},
      startedAt: 0,
      generating: false,
      loadingExisting: false,
      error: null,
      result: null,

  chooseRule(ruleId) {
    const settings = useSettings.getState().settings;
    set({
      ruleId,
      count: ruleId === 'reading' ? settings.readingCount : settings.clozeCount,
      status: 'new-count',
      error: null,
    });
  },

  enterNew() {
    set({
      status: 'new-rule',
      mode: 'new',
      ruleId: null,
      count: 15,
      presetId: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      timedAt: {},
      startedAt: 0,
      generating: false,
      error: null,
      result: null,
    });
  },

  setCount(count) {
    set({ count: Math.max(1, Math.min(50, Math.round(count))) });
  },

  setPreset(id) {
    set({ presetId: id });
  },

  async startNew() {
    const { ruleId, count } = get();
    if (!ruleId) return;
    const settings = useSettings.getState().settings;
    if (!isAIConfigured(settings)) {
      set({ error: '尚未配置 AI，请先到设置页填入 API Key 或切换代理模式。' });
      return;
    }
    set({ generating: true, status: 'generating', error: null });
    try {
      const items = await snapshotQueue(Math.min(count, 50));
      if (items.length === 0) {
        set({
          generating: false,
          status: 'new-count',
          error: '队列里没有单词，先到「录单词」添加几个吧。',
        });
        return;
      }
      const words = items.map((i) => i.card);
      const presets = settings.generationPresets;
      const preset = presets.find((p) => p.id === get().presetId);
      const draft = await generateQuestion(getRule(ruleId), words, settings, undefined, preset);
      const question = toQuestion(ruleId, draft, words);
      await addQuestion(question);
      const now = Date.now();
      set({
        questions: [question],
        status: 'playing',
        mode: 'new',
        currentIndex: 0,
        answers: {},
        timedAt: { [question.id]: now },
        startedAt: now,
        generating: false,
      });
    } catch (e) {
      set({ generating: false, status: 'new-count', error: friendlyMessage(e) });
    }
  },

  async startExisting() {
    set({ loadingExisting: true, error: null });
    try {
      const all = await db.questions.orderBy('createdAt').toArray();
      if (all.length === 0) {
        set({ loadingExisting: false, error: '还没有题目，先生成一题吧。' });
        return;
      }
      const wordIds = [...new Set(all.flatMap((q) => q.wordIds))];
      const states = await db.reviewStates.bulkGet(wordIds);
      const stab = new Map<string, number>();
      wordIds.forEach((id, i) => {
        const s = states[i];
        if (s) stab.set(id, s.stability);
      });
      const sorted = all
        .map((q) => ({
          q,
          w: q.wordIds.length
            ? Math.min(...q.wordIds.map((id) => stab.get(id) ?? 0))
            : Number.POSITIVE_INFINITY,
        }))
        .sort((a, b) => {
          if (a.w === b.w) return 0;
          return a.w - b.w;
        })
        .map((x) => x.q)
        .slice(0, 30);

      const now = Date.now();
      set({
        questions: sorted,
        status: 'playing',
        mode: 'existing',
        currentIndex: 0,
        answers: {},
        timedAt: sorted[0] ? { [sorted[0].id]: now } : {},
        startedAt: now,
        loadingExisting: false,
      });
    } catch (e) {
      set({ loadingExisting: false, error: friendlyMessage(e) });
    }
  },

  answer(qid, index, value) {
    set((s) => ({
      answers: {
        ...s.answers,
        [qid]: { ...(s.answers[qid] ?? {}), [index]: value },
      },
    }));
  },

  goTo(index) {
    const { questions } = get();
    if (index < 0 || index >= questions.length) return;
    const qid = questions[index].id;
    set((s) => ({
      currentIndex: index,
      timedAt: { ...s.timedAt, [qid]: s.timedAt[qid] ?? Date.now() },
    }));
  },

  async submit() {
    const s = get();
    if (s.status !== 'playing' || s.questions.length === 0) return;
    const now = Date.now();
    const settings = useSettings.getState().settings;
    const entries = s.questions.map((q) => ({
      question: q,
      answer: s.answers[q.id] ?? {},
      durationMs: Math.max(0, now - (s.timedAt[q.id] ?? s.startedAt)),
    }));
    try {
      await recordQuestionAttempts(entries, settings.targetRetention, now);
    } catch (e) {
      set({ error: friendlyMessage(e) });
      return;
    }
    const perQuestion = s.questions.map((q) => {
      const grade = getRule(q.type).grade(q, s.answers[q.id] ?? {});
      const resultCounts = Object.values(grade.perItem);
      const totalCount = resultCounts.length;
      const correctCount = resultCounts.filter(Boolean).length;
      return {
        questionId: q.id,
        correctCount,
        totalCount,
        isCorrect: correctCount === totalCount,
        durationMs: Math.max(0, now - (s.timedAt[q.id] ?? s.startedAt)),
      };
    });
    set({
      status: 'done',
      result: {
        perQuestion,
        correctCount: perQuestion.reduce((a, p) => a + p.correctCount, 0),
        totalCount: perQuestion.reduce((a, p) => a + p.totalCount, 0),
        questionCount: perQuestion.length,
      },
    });
  },

  clearError() {
    set({ error: null });
  },

  reset() {
    set({
      status: 'idle',
      mode: null,
      ruleId: null,
      presetId: null,
      questions: [],
      currentIndex: 0,
      answers: {},
      timedAt: {},
      startedAt: 0,
      generating: false,
      loadingExisting: false,
      error: null,
      result: null,
    });
  },
    }),
    {
      name: 'wordapp-game-session-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        status: s.status === 'playing' && s.questions.length > 0 ? 'playing' : 'idle',
        mode: s.status === 'playing' && s.questions.length > 0 ? s.mode : null,
        ruleId: s.status === 'playing' && s.questions.length > 0 ? s.ruleId : null,
        presetId: s.status === 'playing' && s.questions.length > 0 ? s.presetId : null,
        questions: s.status === 'playing' && s.questions.length > 0 ? s.questions : [],
        currentIndex: s.status === 'playing' && s.questions.length > 0 ? s.currentIndex : 0,
        answers: s.status === 'playing' && s.questions.length > 0 ? s.answers : {},
        timedAt: s.status === 'playing' && s.questions.length > 0 ? s.timedAt : {},
        startedAt: s.status === 'playing' && s.questions.length > 0 ? s.startedAt : 0,
      }),
    }
  )
);