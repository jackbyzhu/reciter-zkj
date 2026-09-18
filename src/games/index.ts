import { renderPrompt } from '../prompts/resolve';
import type {
  Card,
  GradeResult,
  HighlightedWord,
  Question,
  QuestionDraft,
  QuestionType,
} from '../types';

export interface PromptContext {
  customInstruction?: string;
  lastPassage?: string;
  genre?: string;
}

export interface GameRule {
  id: QuestionType;
  name: string;
  description: string;
  minWords: number;
  maxWords: number;
  buildPrompt(words: Card[], template: string, ctx?: PromptContext): string;
  parseResponse(raw: string, words: Card[]): QuestionDraft;
  grade(question: Question, answer: Record<number, string>): GradeResult;
}

export function buildGamePrompt(
  words: Card[],
  template: string,
  ctx?: PromptContext
): string {
  const base = renderPrompt(template, {
    words: wordsPromptBody(words),
    count: words.length,
  });
  const parts = [base];
  const genre = ctx?.genre?.trim();
  if (genre) {
    parts.push(
      `\n\n【本次指定的文章性质】\n本文必须写成「${genre}」。请按该体裁的行文特点来组织内容（如：记叙文要有时间线与人称视角，议论文要有论点论据，说明文要条理清晰等），题材也需与体裁匹配。`
    );
  }
  const extra = ctx?.customInstruction?.trim();
  if (extra) {
    parts.push(`\n\n【用户附加要求（优先满足）】\n${extra}`);
  }
  const last = ctx?.lastPassage?.trim();
  if (last) {
    parts.push(
      `\n\n【避免重复：上一篇同类短文如下】\n${last}\n\n请更换主题、题材、叙事视角与用词风格，写一篇与上文差异尽可能大的新短文，禁止复用上文的句子结构和表达。`
    );
  }
  return parts.join('');
}

export function normalizeDifficulty(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 3;
  return Math.min(5, Math.max(1, Math.round(v)));
}

export function normalizeHighlights(v: unknown): HighlightedWord[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((h) => {
      if (!h || typeof h !== 'object') return null;
      const o = h as Record<string, unknown>;
      const start = typeof o.start === 'number' ? o.start : -1;
      const end = typeof o.end === 'number' ? o.end : -1;
      if (start < 0 || end < start) return null;
      return {
        wordId: typeof o.wordId === 'string' ? o.wordId : '',
        text: typeof o.text === 'string' ? o.text : '',
        start,
        end,
      };
    })
    .filter((x): x is HighlightedWord => !!x);
}

export function resolveWordId(answer: string, words: Card[], fallbackId?: string): string {
  const target = answer.trim().toLowerCase();
  const found = words.find((w) => w.word.trim().toLowerCase() === target);
  if (found) return found.id;
  if (fallbackId && words.some((w) => w.id === fallbackId)) return fallbackId;
  return '';
}

export function normalizeOptions(raw: unknown, answer: string): string[] {
  const answerTrim = answer.trim();
  let options: string[] = [];
  if (Array.isArray(raw)) {
    options = raw.filter((o): o is string => typeof o === 'string').map((o) => o.trim());
  }
  if (!options.includes(answerTrim)) {
    options = [answerTrim, ...options];
  }
  const cleansed = options.filter((o) => o.length > 0);
  while (cleansed.length < 4) {
    cleansed.push(`干扰项 ${cleansed.length}`);
  }
  return cleansed.slice(0, 4);
}

export function wordsPromptBody(words: Card[]): string {
  return JSON.stringify(words.map((w) => ({ id: w.id, word: w.word })));
}

export function gradeAnswers(
  items: { index: number; answer: string; wordId: string }[],
  answer: Record<number, string>
): GradeResult {
  const perItem: Record<number, boolean> = {};
  const wordRatings: Record<string, GradeResult['wordRatings'][string]> = {};
  for (const item of items) {
    const selected = typeof answer[item.index] === 'string' ? answer[item.index] : '';
    const isCorrect = selected.trim().toLowerCase() === item.answer.trim().toLowerCase();
    perItem[item.index] = isCorrect;
    if (item.wordId) {
      wordRatings[item.wordId] = isCorrect ? 3 : 1;
    }
  }
  const isCorrect = items.every((item) => perItem[item.index]);
  return { isCorrect, perItem, wordRatings };
}