import { db } from '../db';
import { migrateExportData, migrateSettings } from '../db/migrations';
import { gunzipStringToText, parseJSON, readFileAsArrayBuffer } from './json';
import { uuid } from '../utils/uuid';
import type {
  Attempt,
  Card,
  ExportFile,
  ImportConflictStrategy,
  Question,
  ReviewState,
} from '../types';

export interface ImportResult {
  added: number;
  skipped: number;
  overwritten: number;
}

export interface ImportOptions {
  conflict: ImportConflictStrategy;
  overwritePrompts: boolean;
}

export async function importFromFile(
  file: File,
  options: ImportOptions
): Promise<ImportResult> {
  const buf = await readFileAsArrayBuffer(file);
  const isGz = /\.gz$/i.test(file.name);
  const text = isGz
    ? gunzipStringToText(new Uint8Array(buf))
    : new TextDecoder().decode(buf);
  return importJson(text, options);
}

export async function importJson(text: string, options: ImportOptions): Promise<ImportResult> {
  const parsed = parseJSON(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('文件不是有效的 JSON。');
  }
  const file = parsed as Partial<ExportFile>;
  if (file.format !== 'wordapp-data') {
    throw new Error('不是本应用的导出文件（format 不匹配）。');
  }
  if (typeof file.schemaVersion !== 'number') {
    throw new Error('导出文件缺少 schemaVersion。');
  }

  const migrated = migrateExportData(file.data ?? {}, file.schemaVersion);

  const existingCardKeys = new Set<string>(
    (await db.cards.toCollection().primaryKeys()) as string[]
  );
  const existingQuestionKeys = new Set<string>(
    (await db.questions.toCollection().primaryKeys()) as string[]
  );

  const cardIdMap = new Map<string, string>(); // 旧 id -> 目标 id
  const questionIdMap = new Map<string, string>();

  const cardsToPut: Card[] = [];
  const statesToPut: ReviewState[] = [];
  const questionsToPut: Question[] = [];
  const attemptsToPut: Attempt[] = [];

  const result: ImportResult = { added: 0, skipped: 0, overwritten: 0 };

  // 卡片 ID 决策
  for (const card of migrated.cards) {
    if (options.conflict === 'new-id') {
      const newId = uuid();
      cardIdMap.set(card.id, newId);
      cardsToPut.push({ ...card, id: newId });
      result.added++;
    } else if (options.conflict === 'skip' && existingCardKeys.has(card.id)) {
      cardIdMap.set(card.id, card.id);
      result.skipped++;
    } else {
      cardIdMap.set(card.id, card.id);
      cardsToPut.push(card);
      if (existingCardKeys.has(card.id)) result.overwritten++;
      else result.added++;
    }
  }

  // 复习状态：关联卡片必须存在（新增或已存在）
  for (const state of migrated.reviewStates) {
    const targetId = cardIdMap.get(state.cardId);
    if (targetId === undefined) {
      result.skipped++;
      continue;
    }
    statesToPut.push({ ...state, cardId: targetId });
  }

  // 题目：wordIds 重映射
  for (const question of migrated.questions) {
    const newWordIds = question.wordIds.map((w) => cardIdMap.get(w) ?? w);
    const remapped = { ...question, wordIds: newWordIds };

    if (options.conflict === 'new-id') {
      const newId = uuid();
      questionIdMap.set(question.id, newId);
      questionsToPut.push({ ...remapped, id: newId });
      result.added++;
    } else if (options.conflict === 'skip' && existingQuestionKeys.has(question.id)) {
      questionIdMap.set(question.id, question.id);
      result.skipped++;
    } else {
      questionIdMap.set(question.id, question.id);
      questionsToPut.push(remapped);
      if (existingQuestionKeys.has(question.id)) result.overwritten++;
      else result.added++;
    }
  }

  // 作答记录：questionId 重映射
  for (const attempt of migrated.attempts) {
    const targetId = questionIdMap.get(attempt.questionId);
    if (targetId === undefined) {
      result.skipped++;
      continue;
    }
    attemptsToPut.push({ ...attempt, questionId: targetId });
  }

  await db.transaction(
    'rw',
    [db.cards, db.reviewStates, db.questions, db.attempts, db.settings],
    async () => {
      if (cardsToPut.length) await db.cards.bulkPut(cardsToPut);
      if (statesToPut.length) await db.reviewStates.bulkPut(statesToPut);
      if (questionsToPut.length) await db.questions.bulkPut(questionsToPut);
      if (attemptsToPut.length) await db.attempts.bulkPut(attemptsToPut);

      if (options.overwritePrompts && file.settings?.prompts) {
        const current = await db.settings.get('settings');
        const base = current ? current : undefined;
        const merged = migrateSettings(
          base ? { ...base, prompts: { ...base.prompts, ...file.settings.prompts } } : {}
        );
        await db.settings.put(merged);
      }
    }
  );

  return result;
}