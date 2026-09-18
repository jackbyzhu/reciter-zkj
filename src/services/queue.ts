import { liveQuery } from 'dexie';
import { db } from '../db';
import type { Card, ReviewState } from '../types';

export const QUEUE_LIMIT = 200;

export interface QueueItem {
  state: ReviewState;
  card: Card;
}

async function joinCards(states: ReviewState[]): Promise<QueueItem[]> {
  const cards = await db.cards.bulkGet(states.map((s) => s.cardId));
  return states
    .filter((_, i) => cards[i] && !cards[i]!.deletedAt)
    .map((state, i) => ({ state, card: cards[i] as Card }));
}

/** 队列实时视图：reviewStates 按 due 升序，关联卡片，过滤已删除。 */
export const queue$ = liveQuery(async (): Promise<QueueItem[]> => {
  const states = await db.reviewStates.orderBy('due').limit(QUEUE_LIMIT).toArray();
  return joinCards(states);
});

/** 一次性取一批（复习快照），不中途变化。 */
export async function snapshotQueue(
  batchSize: number,
  limit: number = QUEUE_LIMIT
): Promise<QueueItem[]> {
  const size = Math.max(1, Math.min(batchSize, limit));
  const states = await db.reviewStates.orderBy('due').limit(size).toArray();
  return joinCards(states);
}

/** Home 今日待复习数量：due 不晚于今天结束。用 count()，不用 limit。 */
export async function todayDueCount(now: number = Date.now()): Promise<number> {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return db.reviewStates.where('due').belowOrEqual(end.getTime()).count();
}

/** 队列全部剩余数量（含未到期，用于排队显示）。 */
export async function queueTotalCount(): Promise<number> {
  return db.reviewStates.count();
}