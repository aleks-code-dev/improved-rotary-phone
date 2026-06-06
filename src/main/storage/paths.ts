import path from 'node:path';

let _dataDir: string | null = null;
let _fallbackUserData: string = '';

function getUserDataFallback(): string {
  if (!_fallbackUserData) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { app } = require('electron');
      _fallbackUserData = app.getPath('userData');
    } catch {
      // Running outside Electron (tests) — use temp dir
      _fallbackUserData = require('node:os').tmpdir();
    }
  }
  return _fallbackUserData;
}

export function getUserDataPath(): string {
  return getUserDataFallback();
}

export function getDataDir(): string | null {
  return _dataDir;
}

export function setDataDir(dir: string): void {
  _dataDir = dir;
}

export function getHelperJarPath(): string {
  return path.join(_dataDir || getUserDataPath(), 'bin', 'postmanclone-helper.jar');
}

export function getBundledHelperJarPath(): string {
  try {
    const { app } = require('electron');
    if (!app.isPackaged) {
      return path.join(app.getAppPath(), 'resources', 'helper', 'postmanclone-helper.jar');
    }
    return path.join(process.resourcesPath || '', 'helper', 'postmanclone-helper.jar');
  } catch {
    return path.join(process.cwd(), 'resources', 'helper', 'postmanclone-helper.jar');
  }
}

export function getLogsDir(): string {
  return path.join(_dataDir || getUserDataPath(), 'logs');
}

export function getCollectionsDir(): string {
  return path.join(_dataDir || getUserDataPath(), 'collections');
}

export function getEnvironmentsDir(): string {
  return path.join(_dataDir || getUserDataPath(), 'environments');
}

export function getCollectionDir(id: string): string {
  return path.join(_dataDir || getUserDataPath(), 'collections', id);
}

export function getCollectionJsonPath(id: string): string {
  return path.join(_dataDir || getUserDataPath(), 'collections', id, 'collection.json');
}

export function getCollectionHistoryDir(id: string): string {
  return path.join(_dataDir || getUserDataPath(), 'collections', id, 'history');
}

export function getHistoryEntryPath(collectionId: string, entryId: string): string {
  return path.join(_dataDir || getUserDataPath(), 'collections', collectionId, 'history', `${entryId}.json`);
}

export function getEnvironmentPath(id: string): string {
  return path.join(_dataDir || getUserDataPath(), 'environments', `${id}.json`);
}

export function getGlobalsPath(): string {
  return path.join(_dataDir || getUserDataPath(), 'globals.json');
}

export function getProjectCacheDir(projectId: string): string {
  return path.join(_dataDir || getUserDataPath(), 'project-cache', projectId);
}

export function ensureDirs(): void {
  const base = _dataDir || getUserDataPath();
  const dirs = [base, path.join(base, 'bin'), path.join(base, 'logs'),
               path.join(base, 'collections'), path.join(base, 'environments')];
  for (const dir of dirs) {
    require('node:fs').mkdirSync(dir, { recursive: true });
  }
}