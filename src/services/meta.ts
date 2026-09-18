import { db } from '../db';
import type { QuestionType } from '../types';

export async function getLastPassage(type: QuestionType): Promise<string> {
  const row = await db.meta.get(`lastPassage:${type}`);
  return row?.value ?? '';
}

export async function setLastPassage(type: QuestionType, passage: string): Promise<void> {
  await db.meta.put({ key: `lastPassage:${type}`, value: passage });
}