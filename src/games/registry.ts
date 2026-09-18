import type { QuestionType } from '../types';
import { clozeRule } from './cloze';
import { readingRule } from './reading';
import type { GameRule } from './index';

export const GAME_RULES: Record<QuestionType, GameRule> = {
  cloze: clozeRule,
  reading: readingRule,
};

export const GAME_RULES_LIST: GameRule[] = [clozeRule, readingRule];

export function getRule(type: QuestionType): GameRule {
  return GAME_RULES[type];
}

export type { GameRule } from './index';