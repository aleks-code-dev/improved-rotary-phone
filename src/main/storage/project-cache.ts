import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { getDataDir, getSettings } from './settings.js';
import { writeFileAtomic } from './atomicWrite.js';
import { createHash } from 'node:crypto';

function getBasePath(): string {
  const dataDir = getDataDir();
  if (dataDir) return dataDir;
  const settings = getSettings();
  return (settings.dataDir as string) || require('electron').app.getPath('userData');
}

function getProjectCacheDir(projectId: string): string {
  return path.join(getBasePath(), 'project-cache', projectId);
}

export function computeProjectId(projectPath: string, lastModified: number): string {
  return createHash('sha256').update(`${projectPath}:${lastModified}`).digest('hex').slice(0, 16);
}

export async function saveProjectScanResult(projectId: string, result: any): Promise<void> {
  const dir = getProjectCacheDir(projectId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, 'endpoints.json');
  await writeFileAtomic(filePath, JSON.stringify(result, null, 2));
}

export async function readProjectScanResult(projectId: string): Promise<any | null> {
  try {
    const filePath = path.join(getProjectCacheDir(projectId), 'endpoints.json');
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
