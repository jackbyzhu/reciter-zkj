import { getRetrievability } from './fsrs';
import type { Card, ReviewState } from '../types';

export const DAY = 86400000;

export interface CurveWord {
  card: Card;
  state: ReviewState | null;
  retention: number; // 当前预测记忆保持率 0..1
  dueInDays: number; // 距下次到期天数（负 = 已过期）
  stabilityDays: number;
  reps: number;
  lapses: number;
  difficulty: number;
  status: ReviewState['state'];
}

export interface CurvePoint {
  time: number; // ms
  r: number; // 记忆保持率 0..1
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** 组装每个单词的当前记忆状态。 */
export function buildCurveWords(
  cards: Card[],
  states: ReviewState[],
  target: number,
  now: number = Date.now()
): CurveWord[] {
  const map = new Map<string, ReviewState>();
  for (const s of states) {
    if (s && !map.has(s.cardId)) map.set(s.cardId, s);
  }
  const out: CurveWord[] = [];
  for (const card of cards) {
    if (card.deletedAt) continue;
    const state = map.get(card.id) ?? null;
    const retention = state ? getRetrievability(state, now, target) : 0;
    out.push({
      card,
      state,
      retention: clamp01(Number.isFinite(retention) ? retention : 0),
      dueInDays: state ? (state.due - now) / DAY : Number.POSITIVE_INFINITY,
      stabilityDays: state && state.stability > 0 ? state.stability : 0,
      reps: state?.reps ?? 0,
      lapses: state?.lapses ?? 0,
      difficulty: state?.difficulty ?? 0,
      status: state?.state ?? 'new',
    });
  }
  return out;
}

/** 预测记忆曲线：从上次复习到下次到期后再延展一段，采样保留率。 */
export function retentionCurve(
  state: ReviewState,
  target: number,
  now: number = Date.now(),
  points: number = 40
): CurvePoint[] {
  if (state.state === 'new' || state.stability <= 0) return [];
  const t0 = state.lastReview > 0 ? state.lastReview : now;
  const padDays = Math.max(1, state.scheduledDays, state.stability);
  const end = Math.max(now, state.due) + padDays * DAY;
  if (end - t0 <= 0) return [];

  const out: CurvePoint[] = [];
  for (let i = 0; i <= points; i += 1) {
    const time = t0 + ((end - t0) * i) / points;
    const r = getRetrievability(state, time, target);
    out.push({ time, r: clamp01(Number.isFinite(r) ? r : 0) });
  }
  return out;
}

export interface DayBucket {
  label: string;
  date: Date;
  count: number;
}

/** 未来 N 天每天的到期数量（只统计已开始记忆的单词）。 */
export function nextDueBuckets(
  words: CurveWord[],
  days: number = 7,
  now: number = Date.now()
): DayBucket[] {
  const start = new Date(now);
  start.setHours(24, 0, 0, 0);
  const buckets: DayBucket[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start.getTime() + i * DAY);
    buckets.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, date: d, count: 0 });
  }
  for (const w of words) {
    if (!w.state || w.state.state === 'new' || w.state.reps <= 0) continue;
    const idx = Math.floor((w.state.due - start.getTime()) / DAY);
    if (idx >= 0 && idx < days) buckets[idx].count += 1;
  }
  return buckets;
}

export function endOfToday(now: number = Date.now()): number {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}