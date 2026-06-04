import { randomUUID } from 'node:crypto';
import { CollectionSchema, type Collection } from '../../shared/schemas/collection.js';
import { maskAuthForStorage, type AuthConfig } from '../security/secretMask.js';

export interface ImportPreview {
  itemCount: number;
  folderCount: number;
}

export interface ImportSuccess {
  ok: true;
  collection: Collection;
  preview: ImportPreview;
}

export interface ImportError {
  ok: false;
  error: string;
}

export type ImportResult = ImportSuccess | ImportError;

/**
 * Parse and validate a Postman v2.1 collection JSON string.
 * D-36: Zod validates against CollectionSchema.
 * Returns a preview (item/folder count) before committing to disk.
 */
export function importPostmanCollection(jsonText: string): ImportResult {
  // 1. Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err: any) {
    return { ok: false, error: `Invalid JSON: ${err.message}` };
  }

  // 2. Zod validate
  let collection: Collection;
  try {
    collection = CollectionSchema.parse(parsed);
  } catch (err: any) {
    const firstIssue = err?.issues?.[0];
    const path = firstIssue?.path?.join('.') ?? '';
    const message = firstIssue?.message ?? err.message;
    return { ok: false, error: `Not a valid Postman v2.1 collection${path ? `: ${path}` : ''}: ${message}` };
  }

  // 3. Generate fresh _postman_id but preserve info.name/description/schema
  collection.info = {
    ...collection.info,
    _postman_id: randomUUID(),
  };

  // 4. Add chains extension if missing (D-37)
  if (!('chains' in collection)) {
    (collection as any).chains = [];
  }

  // 5. Count items vs folders for preview
  const counts = countItemsAndFolders(collection.item);
  const preview: ImportPreview = { itemCount: counts.items, folderCount: counts.folders };

  return { ok: true, collection, preview };
}

/**
 * Export a collection to Postman v2.1 JSON string.
 * D-37: Re-validates with Zod, preserves unknown fields via .passthrough(),
 * masks auth credentials in the output (PITFALLS M-3 / D-26).
 */
export function exportPostmanCollection(collection: Collection): { ok: true; json: string } | { ok: false; error: string } {
  try {
    // Re-validate the in-memory model
    const validated = CollectionSchema.parse(collection);

    // Deep clone to avoid mutating the input
    const output = JSON.parse(JSON.stringify(validated));

    // Mask auth credentials in all items and item groups (D-26 / M-3)
    maskAuthInCollection(output);

    const json = JSON.stringify(output, null, 2);
    return { ok: true, json };
  } catch (err: any) {
    return { ok: false, error: `Export failed: ${err.message}` };
  }
}

// --- Helpers ---

interface CountResult { items: number; folders: number; }

function countItemsAndFolders(items: unknown[]): CountResult {
  let itemCount = 0;
  let folderCount = 0;
  for (const it of items) {
    const obj = it as Record<string, unknown>;
    if (obj.item && Array.isArray(obj.item)) {
      folderCount++;
      const sub = countItemsAndFolders(obj.item);
      itemCount += sub.items;
      folderCount += sub.folders;
    } else {
      itemCount++;
    }
  }
  return { items: itemCount, folders: folderCount };
}

function maskAuthInCollection(collection: Record<string, unknown>): void {
  const items = collection.item as Array<Record<string, unknown>> | undefined;
  if (!items || !Array.isArray(items)) return;

  // Mask top-level auth
  if (collection.auth) {
    collection.auth = maskAuthForStorage(collection.auth as AuthConfig);
  }

  // Walk items recursively
  function walk(items: Array<Record<string, unknown>>): void {
    for (const it of items) {
      if (it.request && (it.request as any).auth) {
        (it.request as any).auth = maskAuthForStorage((it.request as any).auth);
      }
      if (it.auth) {
        it.auth = maskAuthForStorage(it.auth as AuthConfig);
      }
      if (it.item && Array.isArray(it.item)) {
        walk(it.item as Array<Record<string, unknown>>);
      }
    }
  }

  walk(items);
}
