import { CARD_PROMPT } from './card';
import { CLOZE_PROMPT, READING_PROMPT } from './games';
import type { PromptTemplates } from '../types';

export const DEFAULT_PROMPTS: PromptTemplates = {
  card: CARD_PROMPT,
  cloze: CLOZE_PROMPT,
  reading: READING_PROMPT,
};