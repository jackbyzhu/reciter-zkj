import type { PromptTemplates } from '../types';

export function isEmpty(s: string | null | undefined): boolean {
  return !s || s.trim().length === 0;
}

export function isNonEmptyWord(s: string): boolean {
  return !isEmpty(s) && s.trim().toLowerCase() !== s.trim().toUpperCase();
}

export function clampNumber(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

export function normalizePromptTemplates(prompts: Partial<PromptTemplates> | undefined): PromptTemplates {
  return {
    card: typeof prompts?.card === 'string' ? prompts.card : '',
    cloze: typeof prompts?.cloze === 'string' ? prompts.cloze : '',
    reading: typeof prompts?.reading === 'string' ? prompts.reading : '',
  };
}

export function validatePrompt(prompt: string, requiredVars: string[]): string[] {
  const missing: string[] = [];
  for (const v of requiredVars) {
    if (!prompt.includes(`{{${v}}}`)) missing.push(v);
  }
  return missing;
}