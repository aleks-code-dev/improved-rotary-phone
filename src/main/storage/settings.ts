import Store from 'electron-store';
import { setDataDir as setPathDataDir } from './paths.js';

const settingsStore = new Store({ name: 'settings' });
const stateStore = new Store({ name: 'state' });

export function getSettings(): Record<string, unknown> {
  return (settingsStore as any).store as Record<string, unknown>;
}

export function setSetting(key: string, value: unknown): void {
  (settingsStore as any).set(key, value);
}

export function getDataDir(): string | undefined {
  return (settingsStore as any).get('dataDir') as string | undefined;
}

export function setDataDir(dir: string): void {
  (settingsStore as any).set('dataDir', dir);
  setPathDataDir(dir);
}

export function getState(): Record<string, unknown> {
  return (stateStore as any).store as Record<string, unknown>;
}

export function setState(partial: Record<string, unknown>): void {
  (stateStore as any).set(partial);
}

export { settingsStore, stateStore };