import { z } from 'zod';
import { RequestSpecSchema } from './collection.js';

// PITFALLS m-1: response bodyBase64 capped at 1MB with bodyTruncated flag
// PITFALLS M-3: auth headers masked at write time (mask happens in storage layer)
export const HistoryEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.number(), // epoch ms
  collectionId: z.string().uuid(),
  request: z.object({
    method: z.string(),
    url: z.string(), // post-resolution
  }).passthrough(), // stores the full request spec (masked)
  response: z.object({
    status: z.number(),
    statusText: z.string(),
    headers: z.array(z.object({ key: z.string(), value: z.string() })),
    bodyBase64: z.string(), // truncated to 1MB
    bodyTruncated: z.boolean(),
    bodySizeBytes: z.number(),
    durationMs: z.number(),
    startedAt: z.number(),
    completedAt: z.number(),
  }).nullable(), // null if request errored
  envSnapshotId: z.string().uuid().nullable(),
}).passthrough();

export type HistoryEntry = z.infer<typeof HistoryEntrySchema>;
