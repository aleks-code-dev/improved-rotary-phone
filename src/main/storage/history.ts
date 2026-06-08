import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileAtomic } from './atomicWrite.js';
import { getCollectionHistoryDir, getHistoryEntryPath } from './paths.js';
import { HistoryEntrySchema, type HistoryEntry } from '../../shared/schemas/history.js';
import { maskHeadersForStorage, maskAuthForStorage, type AuthConfig } from '../security/secretMask.js';

const MAX_HISTORY_ENTRIES = 100;
const BODY_CAP_BYTES = 1_048_576; // 1MB

export interface HistoryEntryInput {
  timestamp: number;
  collectionId: string;
  request: {
    method: string;
    url: string;
    headers?: Array<{ key: string; value: string }>;
    auth?: AuthConfig;
    body?: any;
    [key: string]: unknown;
  };
  response: {
    status: number;
    statusText: string;
    headers?: Array<{ key: string; value: string }>;
    bodyBase64?: string;
    durationMs: number;
    startedAt?: number;
    completedAt?: number;
  } | null;
  envSnapshotId?: string | null;
}

/**
 * Append a history entry for a collection.
 * - Masks auth headers in request and response (PITFALLS M-3)
 * - Masks auth credentials via maskAuthForStorage (D-26)
 * - Caps response body at 1MB (PITFALLS m-1)
 * - Auto-prunes oldest entries when count >= 100 (D-18)
 * - Redacts auth-heavy raw body content
 */
export async function appendHistoryEntry(
  collectionId: string,
  input: HistoryEntryInput,
): Promise<{ id: string }> {
  const entryId = randomUUID();
  const historyDir = getCollectionHistoryDir(collectionId);
  await fs.mkdir(historyDir, { recursive: true });

  // 1. Prune oldest if at cap
  try {
    const existing = await fs.readdir(historyDir);
    const jsonFiles = existing.filter(f => f.endsWith('.json'));
    if (jsonFiles.length >= MAX_HISTORY_ENTRIES) {
      // Get files sorted by mtime ascending, delete oldest
      const withStats = await Promise.all(
        jsonFiles.map(async (f) => {
          const stat = await fs.stat(path.join(historyDir, f));
          return { file: f, mtimeMs: stat.mtimeMs };
        })
      );
      withStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
      const toDelete = withStats.slice(0, jsonFiles.length - (MAX_HISTORY_ENTRIES - 1));
      for (const f of toDelete) {
        await fs.rm(path.join(historyDir, f.file), { force: true });
      }
    }
  } catch {
    // Dir may not exist yet
  }

  // 2. Mask request headers (PITFALLS M-3)
  const reqHeaders = Array.isArray(input.request.headers)
    ? maskHeadersForStorage(input.request.headers)
    : [];

  // 3. Mask request auth credentials (D-26)
  const maskedAuth = input.request.auth ? maskAuthForStorage(input.request.auth) : undefined;

  // 4. Redact auth-heavy raw body (PITFALLS M-3)
  let requestSnapshot = { ...input.request, headers: reqHeaders };
  if (maskedAuth) {
    (requestSnapshot as any).auth = maskedAuth;
  }
  // Check if raw body contains sensitive patterns
  const rawBody = (requestSnapshot as any).body;
  if (rawBody && rawBody.mode === 'raw' && rawBody.text) {
    const sensitivePattern = /\b(authorization|api[-_]?key|token|password)\b[^a-z0-9]*['":\s]+([\w-]{16,})/i;
    if (sensitivePattern.test(rawBody.text)) {
      requestSnapshot = {
        ...requestSnapshot,
        body: { ...rawBody, text: '{"_redacted":"sensitive content redacted"}' },
      };
    }
  }

  // 5. Build response with body truncation (PITFALLS m-1)
  let responseEntry: HistoryEntry['response'] = null;
  if (input.response) {
    const respHeaders = Array.isArray(input.response.headers)
      ? maskHeadersForStorage(input.response.headers)
      : [];
    let bodyBase64 = input.response.bodyBase64 || '';
    let bodyTruncated = false;
    let bodySizeBytes = bodyBase64 ? Buffer.from(bodyBase64, 'base64').byteLength : 0;

    if (bodySizeBytes > BODY_CAP_BYTES) {
      bodyTruncated = true;
      bodyBase64 = Buffer.from(bodyBase64, 'base64').slice(0, BODY_CAP_BYTES).toString('base64');
    }

    responseEntry = {
      status: input.response.status,
      statusText: input.response.statusText,
      headers: respHeaders,
      bodyBase64,
      bodyTruncated,
      bodySizeBytes,
      durationMs: input.response.durationMs,
      startedAt: input.response.startedAt ?? Date.now(),
      completedAt: input.response.completedAt ?? Date.now(),
    };
  }

  // 6. Assemble and validate
  const entry = {
    id: entryId,
    timestamp: input.timestamp,
    collectionId,
    request: requestSnapshot,
    response: responseEntry,
    envSnapshotId: input.envSnapshotId ?? null,
  };

  HistoryEntrySchema.parse(entry);

  // 7. Atomic write
  const filePath = getHistoryEntryPath(collectionId, entryId);
  await writeFileAtomic(filePath, JSON.stringify(entry, null, 2));

  return { id: entryId };
}

/** List history entries for a collection, optionally filtered by search. */
export async function listHistory(
  collectionId: string,
  search?: string,
): Promise<HistoryEntry[]> {
  const historyDir = getCollectionHistoryDir(collectionId);
  const results: HistoryEntry[] = [];

  try {
    const entries = await fs.readdir(historyDir);
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(historyDir, entry), 'utf-8');
        const parsed = HistoryEntrySchema.parse(JSON.parse(raw));
        // Client-side filtering on URL/method/status (D-20)
        if (search) {
          const q = search.toLowerCase();
          const url = (parsed.request as any).url?.toLowerCase() ?? '';
          const method = (parsed.request as any).method?.toLowerCase() ?? '';
          const status = parsed.response?.status?.toString() ?? '';
          if (!url.includes(q) && !method.includes(q) && !status.includes(q)) continue;
        }
        results.push(parsed);
      } catch {
        // Corrupt entry — skip
      }
    }
  } catch {
    // Directory doesn't exist yet
  }

  // Sort by timestamp descending
  results.sort((a, b) => b.timestamp - a.timestamp);
  return results;
}

/** Delete a specific history entry. */
export async function deleteHistoryEntry(collectionId: string, entryId: string): Promise<void> {
  const filePath = getHistoryEntryPath(collectionId, entryId);
  await fs.rm(filePath, { force: true });
}
