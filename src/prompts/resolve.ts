import { DEFAULT_PROMPTS } from './index';
import type { PromptKey, Settings } from '../types';

export function resolvePrompt(key: PromptKey, settings: Settings): string {
  const custom = settings.prompts?.[key]?.trim();
  return custom || DEFAULT_PROMPTS[key];
}

export function renderPrompt(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match
  );
}

export const REQUIRED_VARS: Record<PromptKey, string[]> = {
  card: ['word', 'meaning'],
  cloze: ['words', 'count'],
  reading: ['words', 'count'],
};

export function getMissingVars(key: PromptKey, template: string): string[] {
  const required = REQUIRED_VARS[key];
  return required.filter((v) => !template.includes(`{{${v}}}`));
}