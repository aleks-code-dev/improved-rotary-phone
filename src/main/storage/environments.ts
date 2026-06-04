import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileAtomic } from './atomicWrite.js';
import { getEnvironmentsDir, getEnvironmentPath } from './paths.js';
import { EnvironmentSchema, type Environment } from '../../shared/schemas/environment.js';
import { getSettings, setSetting } from './settings.js';

export interface EnvironmentMeta {
  id: string;
  name: string;
  active: boolean;
}

/** List all environments (metadata + active flag). */
export async function listEnvironments(): Promise<EnvironmentMeta[]> {
  const dir = getEnvironmentsDir();
  const settings = getSettings();
  const activeEnvId = settings.activeEnvId as string | null | undefined;
  const results: EnvironmentMeta[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, entry.name), 'utf-8');
        const parsed = JSON.parse(raw);
        const id = parsed.id ?? entry.name.replace('.json', '');
        results.push({
          id,
          name: parsed.name ?? id,
          active: id === activeEnvId,
        });
      } catch {
        // Corrupt env — skip
      }
    }
  } catch {
    // Directory doesn't exist yet
  }
  return results;
}

/** Read a full environment with Zod validation. */
export async function readEnvironment(id: string): Promise<Environment> {
  const filePath = getEnvironmentPath(id);
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return EnvironmentSchema.parse(parsed);
}

/** Write an environment via atomic rename. */
export async function writeEnvironment(env: Environment): Promise<void> {
  EnvironmentSchema.parse(env);
  const dir = getEnvironmentsDir();
  await fs.mkdir(dir, { recursive: true });
  await writeFileAtomic(getEnvironmentPath(env.id), JSON.stringify(env, null, 2));
}

/** Delete an environment file. */
export async function deleteEnvironment(id: string): Promise<void> {
  await fs.rm(getEnvironmentPath(id), { force: true });
}

/** Set the active environment in settings. */
export async function setActiveEnvironment(id: string | null): Promise<void> {
  const current = getSettings();
  setSetting('activeEnvId', id);
}
