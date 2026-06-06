import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { writeFileAtomic } from './atomicWrite.js';
import { getCollectionsDir, getCollectionDir, getCollectionJsonPath } from './paths.js';
import { CollectionSchema, type Collection } from '../../shared/schemas/collection.js';

export interface CollectionMeta {
  id: string;
  name: string;
  itemCount: number;
  info: { name: string; _postman_id: string };
}

/** List all collections (metadata + item count — lazy loading, no full items). */
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
          itemCount: Array.isArray(minimal.item) ? minimal.item.length : 0,
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

// --- Chain CRUD (Phase 4) ---

import type { Chain, ChainStep, StepResult } from '../../shared/schemas/collection.js';

/** Create a new chain in a collection. */
export async function addChain(collectionId: string, name: string): Promise<{ chainId: string }> {
  const chainId = randomUUID();
  const coll = await readCollection(collectionId);
  const chain: Chain = {
    id: chainId,
    name,
    steps: [],
    createdAt: Date.now(),
  };
  coll.chains.push(chain);
  await updateCollection(collectionId, coll);
  return { chainId };
}

/** Update a chain in a collection. */
export async function updateChain(collectionId: string, chainId: string, chain: Chain): Promise<void> {
  const coll = await readCollection(collectionId);
  const idx = coll.chains.findIndex(c => c.id === chainId);
  if (idx === -1) throw new Error(`Chain ${chainId} not found in collection ${collectionId}`);
  coll.chains[idx] = chain;
  await updateCollection(collectionId, coll);
}

/** Delete a chain from a collection. */
export async function deleteChain(collectionId: string, chainId: string): Promise<void> {
  const coll = await readCollection(collectionId);
  coll.chains = coll.chains.filter(c => c.id !== chainId);
  await updateCollection(collectionId, coll);
}

/** Get a chain from a collection. */
export async function getChain(collectionId: string, chainId: string): Promise<Chain | null> {
  const coll = await readCollection(collectionId);
  return coll.chains.find(c => c.id === chainId) ?? null;
}

/** Save step results for a chain (D-05). */
export async function saveStepResults(
  collectionId: string,
  chainId: string,
  stepResults: Array<{ stepIndex: number; result: StepResult }>
): Promise<void> {
  const coll = await readCollection(collectionId);
  const chain = coll.chains.find(c => c.id === chainId);
  if (!chain) throw new Error(`Chain ${chainId} not found in collection ${collectionId}`);

  for (const { stepIndex, result } of stepResults) {
    const step = chain.steps.find(s => s.stepIndex === stepIndex);
    if (step) {
      step.lastResult = result;
    }
  }

  await updateCollection(collectionId, coll);
}
