import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileAtomic } from './atomicWrite.js';
import { getCollectionsDir, getCollectionDir, getCollectionJsonPath } from './paths.js';
import { CollectionSchema, type Collection } from '../../shared/schemas/collection.js';

export interface CollectionMeta {
  id: string;
  name: string;
  info: { name: string; _postman_id: string };
}

/** List all collections (metadata only — lazy loading). */
export async function listCollections(): Promise<CollectionMeta[]> {
  const dir = getCollectionsDir();
  const results: CollectionMeta[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const jsonPath = getCollectionJsonPath(entry.name);
        const raw = await fs.readFile(jsonPath, 'utf-8');
        const minimal = JSON.parse(raw);
        results.push({
          id: entry.name,
          name: minimal.info?.name ?? entry.name,
          info: { name: minimal.info?.name ?? entry.name, _postman_id: minimal.info?._postman_id ?? entry.name },
        });
      } catch {
        // Corrupt collection — skip
      }
    }
  } catch {
    // Directory doesn't exist yet
  }
  return results;
}

/** Read a full collection with Zod validation. */
export async function readCollection(id: string): Promise<Collection> {
  const jsonPath = getCollectionJsonPath(id);
  const raw = await fs.readFile(jsonPath, 'utf-8');
  const parsed = JSON.parse(raw);
  return CollectionSchema.parse(parsed);
}

/** Create a new collection with a fresh _postman_id. */
export async function createCollection(name: string): Promise<{ id: string }> {
  const id = randomUUID();
  const dir = getCollectionDir(id);
  await fs.mkdir(dir, { recursive: true });

  const collection = {
    info: {
      name,
      _postman_id: randomUUID(),
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' as const,
    },
    item: [],
    variable: [],
    event: [],
    chains: [],
  } as Collection;

  CollectionSchema.parse(collection);
  await writeFileAtomic(getCollectionJsonPath(id), JSON.stringify(collection, null, 2));
  return { id };
}

/** Update an existing collection (full replace). Zod-validates before write. */
export async function updateCollection(id: string, collection: Collection): Promise<void> {
  CollectionSchema.parse(collection);
  const dir = getCollectionDir(id);
  await fs.mkdir(dir, { recursive: true });
  await writeFileAtomic(getCollectionJsonPath(id), JSON.stringify(collection, null, 2));
}

/** Delete a collection directory entirely. */
export async function deleteCollection(id: string): Promise<void> {
  const dir = getCollectionDir(id);
  await fs.rm(dir, { recursive: true, force: true });
}

/** Append a request item to the root item[] of a collection. */
export async function addRequestToCollection(
  collectionId: string,
  request: { name: string; spec: unknown },
): Promise<void> {
  const coll = await readCollection(collectionId);
  coll.item.push({
    name: request.name,
    request: request.spec as any,
    response: [],
    event: [],
  });
  await updateCollection(collectionId, coll);
}

/** Append a folder (ItemGroup) to the root item[] of a collection. */
export async function addFolderToCollection(
  collectionId: string,
  folder: { name: string; item?: unknown[] },
): Promise<void> {
  const coll = await readCollection(collectionId);
  coll.item.push({
    name: folder.name,
    item: folder.item ?? [],
  } as any);
  await updateCollection(collectionId, coll);
}
