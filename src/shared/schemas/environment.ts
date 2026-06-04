import { z } from 'zod';

// D-33: per-environment proxy URL field
// D-26: secret flag for masking in UI (postmanclone extension)
export const EnvironmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  values: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean().default(true),
    secret: z.boolean().default(false), // postmanclone extension
  })),
  proxy: z.string().url().optional(), // D-33
  _postman_variable_scope: z.literal('environment').default('environment'),
}).passthrough();

export type Environment = z.infer<typeof EnvironmentSchema>;
