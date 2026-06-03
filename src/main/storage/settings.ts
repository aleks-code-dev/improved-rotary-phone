import Store from 'electron-store';
import { z } from 'zod';
import { atomicWrite } from './atomicWrite.js';

const SettingsSchema = z.object({
  version: z.number().default(1),
  theme: z.enum(['system', 'dark', 'light']).default('system'),
  dataDir: z.string().optional(),
  activeEnvId: z.string().uuid().nullable().optional(),
  window: z.record(z.string(), z.unknown()).optional(),
  sidebar: z.record(z.string(), z.unknown()).optional(),
  helper: z.record(z.string(), z.unknown()).optional(),
});

const StateSchema = z.object({
  openTabs: z.array(z.object({
    id: z.string().uuid(),
    method: z.string(),
    url: z.string(),
  })).default([]),
  activeTabId: z.string().uuid().nullable().optional(),
  lastCollectionId: z.string().uuid().nullable().optional(),
});

type Settings = z.infer<typeof SettingsSchema>;
type State = z.infer<typeof StateSchema>;

const settingsStore = new Store<Settings>({ name: 'settings', schema: SettingsSchema });
const stateStore = new Store<State>({ name: 'state', schema: StateSchema });

export function getSettings(): Settings {
  return settingsStore.store;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settingsStore.set(key, value);
}

export function getDataDir(): string | undefined {
  return settingsStore.get('dataDir');
}

export function setDataDir(dir: string): void {
  settingsStore.set('dataDir', dir);
  require('./paths').setDataDir(dir);
}

export function getState(): State {
  return stateStore.store;
}

export function setState(partial: Partial<State>): void {
  stateStore.store = { ...stateStore.store, ...partial };
}

export { settingsStore, stateStore };