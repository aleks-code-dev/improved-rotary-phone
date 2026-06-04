import Store from 'electron-store';

const settingsStore = new Store({ name: 'settings' });
const stateStore = new Store({ name: 'state' });

export function getSettings(): any {
  return settingsStore.store;
}

export function setSetting(key: string, value: any): void {
  settingsStore.set(key, value);
}

export function getDataDir(): string | undefined {
  return settingsStore.get('dataDir');
}

export function setDataDir(dir: string): void {
  settingsStore.set('dataDir', dir);
  require('./paths').setDataDir(dir);
}

export function getState(): any {
  return stateStore.store;
}

export function setState(partial: any): void {
  stateStore.store = { ...stateStore.store, ...partial };
}

export { settingsStore, stateStore };