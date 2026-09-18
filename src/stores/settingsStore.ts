import { create } from 'zustand';
import { db } from '../db';
import { createDefaultSettings, migrateSettings } from '../db/migrations';
import type { Settings } from '../types';

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  init: () => Promise<void>;
  reload: () => Promise<void>;
  save: (next: Settings) => Promise<void>;
  patch: (patch: Partial<Settings>) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: createDefaultSettings(),
  loaded: false,

  async init() {
    if (get().loaded) return;
    await get().reload();
  },

  async reload() {
    const existing = await db.settings.get('settings');
    const settings = existing ? migrateSettings(existing) : createDefaultSettings();
    if (!existing) {
      await db.settings.put(settings);
    }
    set({ settings, loaded: true });
  },

  async save(next: Settings) {
    const normalized = migrateSettings(next);
    await db.settings.put(normalized);
    set({ settings: normalized, loaded: true });
  },

  async patch(patch: Partial<Settings>) {
    await get().save({ ...get().settings, ...patch });
  },
}));

export function isAIConfigured(settings: Settings): boolean {
  return settings.aiMode === 'proxy' || settings.aiApiKey.trim().length > 0;
}