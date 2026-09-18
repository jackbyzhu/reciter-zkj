import Dexie, { type Table } from 'dexie';
import type { Attempt, Card, Meta, Question, ReviewState, Settings } from '../types';

export class WordAppDB extends Dexie {
  cards!: Table<Card, string>;
  reviewStates!: Table<ReviewState, string>;
  questions!: Table<Question, string>;
  attempts!: Table<Attempt, string>;
  settings!: Table<Settings, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('wordapp');
    this.version(1).stores({
      cards: 'id, word, createdAt, updatedAt, deletedAt, *tags',
      reviewStates: 'cardId, due, state',
      questions: 'id, type, createdAt, *wordIds',
      attempts: 'id, questionId, createdAt',
      settings: 'id',
    });
    this.version(2).stores({
      cards: 'id, word, createdAt, updatedAt, deletedAt, *tags',
      reviewStates: 'cardId, due, state',
      questions: 'id, type, createdAt, *wordIds',
      attempts: 'id, questionId, createdAt',
      settings: 'id',
      meta: 'key',
    });
  }
}

export const db = new WordAppDB();