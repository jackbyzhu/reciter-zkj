import type { Blank, Card, ClozeQuestion, QuestionDraft } from '../types';
import { extractJson } from '../services/json';
import {
  type GameRule,
  type PromptContext,
  buildGamePrompt,
  gradeAnswers,
  normalizeDifficulty,
  normalizeOptions,
  resolveWordId,
} from './index';

function parseDraft(raw: string, words: Card[]): QuestionDraft {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI 返回的内容不是有效 JSON。');
  }
  const obj = parsed as Record<string, unknown>;

  const passage = typeof obj.passage === 'string' ? obj.passage.trim() : '';
  if (!passage) throw new Error('短文内容缺失。');

  const rawBlanks = Array.isArray(obj.blanks) ? obj.blanks : [];
  const blanks: Blank[] = rawBlanks
    .map((b, i) => {
      if (!b || typeof b !== 'object') return null;
      const o = b as Record<string, unknown>;
      const answer = typeof o.answer === 'string' ? o.answer : '';
      const providedWordId = typeof o.wordId === 'string' ? o.wordId : '';
      const wordId = resolveWordId(answer, words, providedWordId);
      return {
        index: typeof o.index === 'number' ? o.index : i,
        answer,
        options: normalizeOptions(o.options, answer),
        wordId,
      };
    })
    .filter((b): b is Blank => !!b && b.answer.trim().length > 0);

  if (blanks.length === 0) throw new Error('题目没有生成有效的填空。');

  return {
    content: { passage, blanks },
    translation: typeof obj.translation === 'string' ? obj.translation : '',
    explanation: typeof obj.explanation === 'string' ? obj.explanation : '',
    highlightedWords: [],
    difficulty: normalizeDifficulty(obj.difficulty),
  };
}

export const clozeRule: GameRule = {
  id: 'cloze',
  name: '完形填空',
  description: '一段短文挖空，选出正确的目标单词。',
  minWords: 5,
  maxWords: 30,

  buildPrompt(words: Card[], template: string, ctx?: PromptContext): string {
    return buildGamePrompt(words, template, ctx);
  },

  parseResponse(raw: string, words: Card[]): QuestionDraft {
    return parseDraft(raw, words);
  },

  grade(question, answer) {
    const cloze = question as ClozeQuestion;
    const items = cloze.content.blanks.map((b) => ({
      index: b.index,
      answer: b.answer,
      wordId: b.wordId,
    }));
    return gradeAnswers(items, answer);
  },
};