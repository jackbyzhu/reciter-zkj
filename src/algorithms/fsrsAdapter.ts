import { State } from 'ts-fsrs';
import type { Rating, ReviewState, ReviewStateName, FsrsCard } from '../types';

const STATE_TO_NUM: Record<ReviewStateName, number> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
};

const NUM_TO_STATE: Record<number, ReviewStateName> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
};

export function toFsrsCard(state: ReviewState): FsrsCard {
  return {
    due: new Date(state.due),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: 0,
    reps: state.reps,
    lapses: state.lapses,
    state: STATE_TO_NUM[state.state] ?? State.New,
    last_review: state.lastReview > 0 ? new Date(state.lastReview) : undefined,
  };
}

export function fromFsrsCard(
  cardId: string,
  card: FsrsCard,
  lastRating: Rating = 3,
  now: number = Date.now()
): ReviewState {
  return {
    cardId,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: NUM_TO_STATE[card.state] ?? 'new',
    lastReview: card.last_review ? card.last_review.getTime() : now,
    lastRating,
    updatedAt: now,
    schemaVersion: 1,
  };
}