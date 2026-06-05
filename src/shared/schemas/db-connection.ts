import { z } from 'zod';

export const DbConnectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string(),
  user: z.string(),
  passwordEncrypted: z.string(),
  dbType: z.enum(['postgresql', 'mysql', 'oracle', 'h2']),
  createdAt: z.number(),
});

export const DbConnectionMetaSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  dbType: z.string(),
  connected: z.boolean().default(false),
});

export type DbConnection = z.infer<typeof DbConnectionSchema>;
export type DbConnectionMeta = z.infer<typeof DbConnectionMetaSchema>;
