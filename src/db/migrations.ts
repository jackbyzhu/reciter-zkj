import { DEFAULT_PROMPTS } from '../prompts';
import type {
  Attempt,
  Card,
  ExportData,
  GenerationPreset,
  Question,
  ReviewState,
  Settings,
} from '../types';

export const CURRENT_RECORD_SCHEMA_VERSION = 1;
export const CURRENT_SETTINGS_SCHEMA_VERSION = 4;
export const DATA_FORMAT_VERSION = 1;

export function createDefaultSettings(): Settings {
  return {
    id: 'settings',
    aiProvider: '',
    aiApiKey: '',
    aiModel: '',
    aiBaseUrl: '',
    aiMode: 'direct',
    targetRetention: 0.9,
    reviewBatchSize: 20,
    clozeCount: 15,
    readingCount: 5,
    gameRulesEnabled: ['cloze', 'reading'],
    libraryView: 'card',
    prompts: { ...DEFAULT_PROMPTS },
    customInstruction: '',
    generationPresets: [],
    schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
  };
}

function normalizePreset(raw: unknown): GenerationPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!name) return null;
  return {
    id: typeof o.id === 'string' && o.id ? o.id : `preset-${Math.random().toString(36).slice(2, 8)}`,
    name,
    genre: typeof o.genre === 'string' ? o.genre : '',
    instruction: typeof o.instruction === 'string' ? o.instruction : '',
  };
}

export function migrateSettings(raw: Partial<Settings> | undefined | null): Settings {
  const base = createDefaultSettings();
  if (!raw) return base;

  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1;
  if (version > CURRENT_SETTINGS_SCHEMA_VERSION) {
    throw new Error(
      `数据版本过新：settings.schemaVersion=${version}，当前支持最高 ${CURRENT_SETTINGS_SCHEMA_VERSION}，请升级应用。`
    );
  }

  const prompts =
    version >= 2 && raw.prompts
      ? {
          card: raw.prompts.card?.trim() || base.prompts.card,
          cloze: raw.prompts.cloze?.trim() || base.prompts.cloze,
          reading: raw.prompts.reading?.trim() || base.prompts.reading,
        }
      : { ...base.prompts };

  return {
    ...base,
    ...raw,
    prompts,
    customInstruction: str(raw.customInstruction, base.customInstruction),
    generationPresets: Array.isArray(raw.generationPresets)
      ? raw.generationPresets.map(normalizePreset).filter((p): p is GenerationPreset => !!p)
      : base.generationPresets,
    schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
  };
}

function assertVersion(version: number, name: string): void {
  if (version > CURRENT_RECORD_SCHEMA_VERSION) {
    throw new Error(
      `数据版本过新：${name}.schemaVersion=${version}，当前支持最高 ${CURRENT_RECORD_SCHEMA_VERSION}，请升级应用。`
    );
  }
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export function migrateCard(raw: Partial<Card>): Card {
  assertVersion(num(raw.schemaVersion, 0) || 0, 'cards');
  const now = Date.now();
  const examples = Array.isArray(raw.examples)
    ? raw.examples.filter((e) => e && typeof e === 'object')
    : [];
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === 'string') : [];
  return {
    id: str(raw.id) || `legacy-${now}-${Math.random().toString(36).slice(2, 8)}`,
    word: str(raw.word).trim(),
    pos: str(raw.pos),
    meaning: str(raw.meaning),
    pronunciation: str(raw.pronunciation),
    humorExplanation: str(raw.humorExplanation),
    roots: str(raw.roots),
    mnemonic: str(raw.mnemonic),
    examples,
    tags,
    source: raw.source === 'user_added' || raw.source === 'ai_generated' || raw.source === 'imported' ? raw.source : 'imported',
    createdAt: num(raw.createdAt, now),
    updatedAt: num(raw.updatedAt, now),
    schemaVersion: CURRENT_RECORD_SCHEMA_VERSION,
  };
}

export function migrateReviewState(raw: Partial<ReviewState>): ReviewState {
  assertVersion(num(raw.schemaVersion, 0) || 0, 'reviewStates');
  const now = Date.now();
  const state = raw.state === 'learning' || raw.state === 'review' || raw.state === 'relearning' ? raw.state : 'new';
  return {
    cardId: str(raw.cardId),
    due: num(raw.due, now),
    stability: num(raw.stability, 0),
    difficulty: num(raw.difficulty, 5),
    elapsedDays: num(raw.elapsedDays, 0),
    scheduledDays: num(raw.scheduledDays, 0),
    reps: num(raw.reps, 0),
    lapses: num(raw.lapses, 0),
    state,
    lastReview: num(raw.lastReview, 0),
    lastRating: raw.lastRating === 1 || raw.lastRating === 2 || raw.lastRating === 3 || raw.lastRating === 4 ? raw.lastRating : 3,
    updatedAt: num(raw.updatedAt, now),
    schemaVersion: CURRENT_RECORD_SCHEMA_VERSION,
  };
}

export function migrateQuestion(raw: Partial<Question>): Question {
  assertVersion(num(raw.schemaVersion, 0) || 0, 'questions');
  const now = Date.now();
  const type = raw.type === 'reading' ? 'reading' : 'cloze';
  const content = raw.content as Question['content'];
  return {
    id: str(raw.id) || `legacy-${now}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    gameRule: type,
    wordIds: Array.isArray(raw.wordIds) ? raw.wordIds.filter((w) => typeof w === 'string') : [],
    explanation: str(raw.explanation),
    translation: raw.translation === undefined ? undefined : str(raw.translation),
    highlightedWords: Array.isArray(raw.highlightedWords) ? raw.highlightedWords : [],
    difficulty: num(raw.difficulty, 3),
    content: content as never,
    source: raw.source === 'ai_generated' || raw.source === 'imported' ? raw.source : 'imported',
    createdAt: num(raw.createdAt, now),
    schemaVersion: CURRENT_RECORD_SCHEMA_VERSION,
  } as Question;
}

export function migrateAttempt(raw: Partial<Attempt>): Attempt {
  assertVersion(num(raw.schemaVersion, 0) || 0, 'attempts');
  return {
    id: str(raw.id) || `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    questionId: str(raw.questionId),
    answers: Array.isArray(raw.answers) ? raw.answers : [],
    isCorrect: !!raw.isCorrect,
    durationMs: num(raw.durationMs, 0),
    createdAt: num(raw.createdAt, Date.now()),
    schemaVersion: CURRENT_RECORD_SCHEMA_VERSION,
  };
}

export function migrateExportData(raw: Partial<ExportData>, fromVersion: number): ExportData {
  if (fromVersion > DATA_FORMAT_VERSION) {
    throw new Error(
      `数据版本过新：格式 schemaVersion=${fromVersion}，当前支持最高 ${DATA_FORMAT_VERSION}，请升级应用。`
    );
  }
  return {
    cards: Array.isArray(raw.cards) ? raw.cards.map(migrateCard) : [],
    reviewStates: Array.isArray(raw.reviewStates) ? raw.reviewStates.map(migrateReviewState) : [],
    questions: Array.isArray(raw.questions) ? raw.questions.map(migrateQuestion) : [],
    attempts: Array.isArray(raw.attempts) ? raw.attempts.map(migrateAttempt) : [],
  };
}