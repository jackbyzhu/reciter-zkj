import type { Card, QuestionDraft, ReadingQuestion, ReadingSubQuestion } from '../types';
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
import { locateHighlights } from './findWords';

function parseDraft(raw: string, words: Card[]): QuestionDraft {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI 返回的内容不是有效 JSON。');
  }
  const obj = parsed as Record<string, unknown>;

  const passage = typeof obj.passage === 'string' ? obj.passage.trim() : '';
  if (!passage) throw new Error('短文内容缺失。');

  const rawQuestions = Array.isArray(obj.questions) ? obj.questions : [];
  const questions: ReadingSubQuestion[] = rawQuestions
    .map((q, i) => {
      if (!q || typeof q !== 'object') return null;
      const o = q as Record<string, unknown>;
      const stem = typeof o.stem === 'string' ? o.stem : '';
      const answer = typeof o.answer === 'string' ? o.answer : '';
      const providedWordId = typeof o.wordId === 'string' ? o.wordId : '';
      const wordId = resolveWordId(answer, words, providedWordId);
      return {
        index: typeof o.index === 'number' ? o.index : i,
        stem: stem.trim(),
        options: normalizeOptions(o.options, answer),
        answer,
        wordId,
      };
    })
    .filter((q): q is ReadingSubQuestion => !!q && q.stem.length > 0 && q.answer.trim().length > 0);

  if (questions.length === 0) throw new Error('题目没有生成有效的选择题。');

  const wordMap = new Map(words.map((w) => [w.id, w.word]));
  const locateList = [...new Set(questions.map((q) => q.wordId).filter(Boolean))]
    .map((id) => ({ wordId: id, word: wordMap.get(id) ?? '' }))
    .filter((item) => item.word.length > 0);
  const highlightedWords = locateHighlights(passage, locateList);

  return {
    content: { passage, questions },
    translation: typeof obj.translation === 'string' ? obj.translation : '',
    explanation: typeof obj.explanation === 'string' ? obj.explanation : '',
    highlightedWords,
    difficulty: normalizeDifficulty(obj.difficulty),
  };
}

export const readingRule: GameRule = {
  id: 'reading',
  name: '阅读理解',
  description: '阅读短文并回答选择题，目标单词在文中高亮。',
  minWords: 5,
  maxWords: 25,

  buildPrompt(words: Card[], template: string, ctx?: PromptContext): string {
    return buildGamePrompt(words, template, ctx);
  },

  parseResponse(raw: string, words: Card[]): QuestionDraft {
    return parseDraft(raw, words);
  },

  grade(question, answer) {
    const reading = question as ReadingQuestion;
    const items = reading.content.questions.map((q) => ({
      index: q.index,
      answer: q.answer,
      wordId: q.wordId,
    }));
    return gradeAnswers(items, answer);
  },
};