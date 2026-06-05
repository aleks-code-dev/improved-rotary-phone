import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileAtomic } from './atomicWrite.js';
import { getDataDir } from './settings.js';
import { encryptCredential, decryptCredential } from '../ipc/safeStorage.js';
import { DbConnectionSchema, type DbConnection, type DbConnectionMeta } from '../../shared/schemas/db-connection.js';

export async function listConnections(): Promise<DbConnectionMeta[]> {
  const dataDir = getDataDir();
  if (!dataDir) return [];
  const dir = path.join(dataDir, 'db-connections');
  const results: DbConnectionMeta[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const raw = await fs.readFile(path.join(dir, entry.name, 'connection.json'), 'utf-8');
        const parsed = JSON.parse(raw);
        results.push({
          id: entry.name,
          name: parsed.name ?? entry.name,
          dbType: parsed.dbType ?? 'unknown',
          connected: false,
        });
      } catch { /* corrupt — skip */ }
    }
  } catch { /* dir doesn't exist */ }
  return results;
}

export async function readConnection(id: string): Promise<DbConnection> {
  const dataDir = getDataDir();
  if (!dataDir) throw new Error('Data directory not set');
  const filePath = path.join(dataDir, 'db-connections', id, 'connection.json');
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return DbConnectionSchema.parse(parsed);
}

export async function readConnectionDecrypted(id: string): Promise<DbConnection & { password: string }> {
  const conn = await readConnection(id);
  const password = await decryptCredential(Buffer.from(conn.passwordEncrypted, 'base64'));
  return { ...conn, password };
}

export async function createConnection(
  name: string,
  url: string,
  user: string,
  password: string,
  dbType: 'postgresql' | 'mysql' | 'oracle' | 'h2',
): Promise<{ id: string }> {
  const dataDir = getDataDir();
  if (!dataDir) throw new Error('Data directory not set');
  const id = randomUUID();
  const dir = path.join(dataDir, 'db-connections', id);
  await fs.mkdir(dir, { recursive: true });

  const encryptedPassword = await encryptCredential(password);
  const connection: DbConnection = {
    id,
    name,
    url,
    user,
    passwordEncrypted: encryptedPassword.toString('base64'),
    dbType,
    createdAt: Date.now(),
  };

  DbConnectionSchema.parse(connection);
  await writeFileAtomic(
    path.join(dir, 'connection.json'),
    JSON.stringify(connection, null, 2)
  );
  return { id };
}

export async function deleteConnection(id: string): Promise<void> {
  const dataDir = getDataDir();
  if (!dataDir) throw new Error('Data directory not set');
  const dir = path.join(dataDir, 'db-connections', id);
  await fs.rm(dir, { recursive: true, force: true });
}
