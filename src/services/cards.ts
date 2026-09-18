import { db } from '../db';
import type { Card, ReviewState } from '../types';

/** 活跃（未删除）卡片列表 */
export async function getActiveCards(): Promise<Card[]> {
  const all = await db.cards.toArray();
  return all.filter((c) => !c.deletedAt);
}

export async function getCard(id: string): Promise<Card | undefined> {
  return db.cards.get(id);
}

export async function getCardsByIds(ids: string[]): Promise<Card[]> {
  return db.cards.bulkGet(ids).then((arr) => arr.filter((c): c is Card => !!c));
}

export async function getState(cardId: string): Promise<ReviewState | undefined> {
  return db.reviewStates.get(cardId);
}

export async function getStatesByIds(ids: string[]): Promise<ReviewState[]> {
  return db.reviewStates.bulkGet(ids).then((arr) => arr.filter((s): s is ReviewState => !!s));
}

export function matchQuery(cards: Card[], query: string, selectedTags: string[]): Card[] {
  const q = query.trim().toLowerCase();
  return cards.filter((c) => {
    if (q && !c.word.toLowerCase().includes(q) && !c.meaning.toLowerCase().includes(q)) {
      return false;
    }
    if (selectedTags.length > 0 && !selectedTags.every((t) => c.tags.includes(t))) {
      return false;
    }
    return true;
  });
}

export function dueComparison(a: string | undefined, b: string | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a < b ? -1 : 1;
}