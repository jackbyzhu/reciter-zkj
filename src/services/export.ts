import { db } from '../db';
import { DATA_FORMAT_VERSION } from '../db/migrations';
import { gzipString } from './json';
import type { Card, ExportFile, Settings } from '../types';

export function pickExportSettings(s: Settings): Partial<Settings> {
  const { aiApiKey: _key, id: _id, ...rest } = s;
  return rest;
}

export async function buildExportFile(): Promise<ExportFile> {
  const activeCards = (await db.cards.toArray()).filter((c) => !c.deletedAt);
  const cardIds = new Set(activeCards.map((c) => c.id));

  const reviewStates = (await db.reviewStates.toArray()).filter((s) => cardIds.has(s.cardId));
  const questions = await db.questions.toArray();
  const attempts = await db.attempts.toArray();
  const settings = await db.settings.get('settings');

  const data = {
    cards: activeCards as Card[],
    reviewStates,
    questions,
    attempts,
  };

  return {
    format: 'wordapp-data',
    schemaVersion: DATA_FORMAT_VERSION,
    exportedAt: Date.now(),
    count: data.cards.length,
    data,
    settings: settings ? pickExportSettings(settings) : undefined,
  };
}

export function serializeExportFile(file: ExportFile): string {
  return JSON.stringify(file);
}

export function exportToGzip(file: ExportFile): Uint8Array {
  return gzipString(serializeExportFile(file));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadExport(): Promise<void> {
  const file = await buildExportFile();
  const bytes = exportToGzip(file);
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/gzip' });
  const date = new Date(file.exportedAt)
    .toISOString()
    .slice(0, 19)
    .replace(/\-/g, '')
    .replace(/\:/g, '')
    .replace(/T/g, '');
  downloadBlob(blob, `wordapp-backup-${date}.json.gz`);
}