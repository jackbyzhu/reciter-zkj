import { fsrs, createEmptyCard, type Grade } from 'ts-fsrs';
import { toFsrsCard, fromFsrsCard } from './fsrsAdapter';
import type { Rating, ReviewState } from '../types';

export const MIN_TARGET_RETENTION = 0.7;
export const MAX_TARGET_RETENTION = 1;

export function createInitialState(cardId: string, now: number = Date.now()): ReviewState {
  const card = createEmptyCard(now);
  return fromFsrsCard(cardId, card, 3, now);
}

function getInstance(targetRetention: number) {
  const retention = Math.min(MAX_TARGET_RETENTION, Math.max(MIN_TARGET_RETENTION, targetRetention));
  return fsrs({ request_retention: retention });
}

export function applyRating(
  state: ReviewState,
  rating: Rating,
  now: number = Date.now(),
  targetRetention: number = 0.9
): ReviewState {
  const instance = getInstance(targetRetention);
  const card = toFsrsCard(state);
  const record = instance.next(card, now, rating as Grade);
  return fromFsrsCard(state.cardId, record.card, rating, now);
}

export function getRetrievability(
  state: ReviewState,
  now: number = Date.now(),
  targetRetention: number = 0.9
): number {
  const instance = getInstance(targetRetention);
  const card = toFsrsCard(state);
  return instance.get_retrievability(card, now, false);
}