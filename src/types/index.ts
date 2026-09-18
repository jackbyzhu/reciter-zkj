// ===== 记忆评分类型 =====

export type Rating = 1 | 2 | 3 | 4; // Again=1, Hard=2, Good=3, Easy=4

export type ReviewStateName = 'new' | 'learning' | 'review' | 'relearning';

export type CardSource = 'user_added' | 'ai_generated' | 'imported';

// ===== 单词卡片 =====

export interface Card {
  id: string;
  word: string;
  pos: string; // 词性，如 "n. 名词 / v. 动词"
  meaning: string;
  pronunciation: string;
  humorExplanation: string;
  roots: string;
  mnemonic: string;
  examples: { en: string; zh: string }[];
  tags: string[];
  source: CardSource;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
  schemaVersion: number;
}

// ===== 复习状态（持久化层：camelCase + 毫秒时间戳）=====

export interface ReviewState {
  cardId: string;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: ReviewStateName;
  lastReview: number;
  lastRating: Rating;
  updatedAt: number;
  schemaVersion: number;
}

// ===== ts-fsrs 适配层（snake_case + Date，不直接持久化）=====

export interface FsrsCard {
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number; // ts-fsrs State enum 数值
  last_review?: Date;
}

// ===== 题目 =====

export type QuestionType = 'cloze' | 'reading';

export type QuestionSource = 'ai_generated' | 'imported';

export interface Blank {
  index: number;
  answer: string;
  options: string[];
  wordId: string;
}

export interface ReadingSubQuestion {
  index: number;
  stem: string;
  options: string[];
  answer: string;
  wordId: string;
}

export interface HighlightedWord {
  wordId: string;
  text: string;
  start: number;
  end: number;
}

interface QuestionBase {
  id: string;
  type: QuestionType;
  gameRule: QuestionType;
  wordIds: string[];
  explanation: string;
  translation?: string;
  highlightedWords: HighlightedWord[];
  difficulty: number;
  source: QuestionSource;
  createdAt: number;
  schemaVersion: number;
}

export interface ClozeQuestion extends QuestionBase {
  type: 'cloze';
  content: { passage: string; blanks: Blank[] };
}

export interface ReadingQuestion extends QuestionBase {
  type: 'reading';
  content: { passage: string; questions: ReadingSubQuestion[] };
  translation: string;
}

export type Question = ClozeQuestion | ReadingQuestion;

export interface QuestionDraft {
  content: ClozeQuestion['content'] | ReadingQuestion['content'];
  translation?: string;
  explanation: string;
  highlightedWords: HighlightedWord[];
  difficulty: number;
}

export interface GradeResult {
  isCorrect: boolean;
  perItem: Record<number, boolean>;
  wordRatings: Record<string, Rating>;
}

// ===== 作答记录 =====

export interface AttemptAnswer {
  index: number;
  answer: string;
  isCorrect: boolean;
  wordId?: string;
}

export interface Attempt {
  id: string;
  questionId: string;
  answers: AttemptAnswer[];
  isCorrect: boolean;
  durationMs: number;
  createdAt: number;
  schemaVersion: number;
}

// ===== 设置 =====

export type PromptKey = 'card' | 'cloze' | 'reading';

export type PromptTemplates = Record<PromptKey, string>;

export interface GenerationPreset {
  id: string;
  name: string;
  genre: string;      // 文章性质，如 记叙文 / 议论文 / 科普文…，可空表示不限
  instruction: string; // 个性化补充提示词
}

export type AiMode = 'direct' | 'proxy';

export type LibraryView = 'card' | 'list';

export type ImportConflictStrategy = 'skip' | 'overwrite' | 'new-id';

export interface Settings {
  id: 'settings';
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
  aiBaseUrl: string;
  aiMode: AiMode;
  targetRetention: number;
  reviewBatchSize: number; // 默认 20，范围 1-100
  clozeCount: number; // 默认 15
  readingCount: number; // 默认 5
  gameRulesEnabled: QuestionType[];
  libraryView: LibraryView;
  prompts: PromptTemplates;
  customInstruction: string;
  generationPresets: GenerationPreset[];
  schemaVersion: number;
}

// ===== 键值元数据 =====

export interface Meta {
  key: string;
  value: string;
}

// ===== 导入导出 =====

export interface ExportData {
  cards: Card[];
  reviewStates: ReviewState[];
  questions: Question[];
  attempts: Attempt[];
}

export interface ExportFile {
  format: 'wordapp-data';
  schemaVersion: number;
  exportedAt: number;
  count: number;
  data: ExportData;
  settings?: Partial<Settings>;
}