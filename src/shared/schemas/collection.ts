import { z } from 'zod';

// --- Variable Schema (shared across collection and environment) ---
export const VariableSchema = z.object({
  key: z.string(),
  value: z.union([z.string(), z.record(z.string(), z.unknown())]),
  type: z.enum(['string', 'number', 'boolean', 'json', 'secret']).optional(),
}).passthrough();

export type Variable = z.infer<typeof VariableSchema>;

// --- Request Spec Schema (kept in sync with main/ipc/channels.ts) ---
export const RequestSpecSchema = z.object({
  requestId: z.string().uuid(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  url: z.string(),
  headers: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean().default(true),
  })),
  queryParams: z.array(z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean().default(true),
  })),
  pathParams: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })),
  body: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('none') }),
    z.object({
      mode: z.literal('raw'),
      contentType: z.enum(['application/json', 'application/xml', 'text/plain', 'application/graphql']),
      text: z.string(),
    }),
    z.object({
      mode: z.literal('urlencoded'),
      fields: z.array(z.object({ key: z.string(), value: z.string() })),
    }),
    z.object({
      mode: z.literal('form-data'),
      fields: z.array(z.object({
        key: z.string(),
        value: z.string(),
        type: z.enum(['text', 'file']),
        filePath: z.string().optional(),
      })),
    }),
    z.object({
      mode: z.literal('binary'),
      filePath: z.string(),
      contentType: z.string(),
    }),
  ]),
  auth: z.discriminatedUnion('type', [
    z.object({ type: z.literal('none') }),
    z.object({ type: z.literal('bearer'), token: z.string() }),
    z.object({ type: z.literal('basic'), username: z.string(), password: z.string() }),
    z.object({ type: z.literal('api-key'), key: z.string(), value: z.string(), in: z.enum(['header', 'query']) }),
  ]),
  settings: z.object({
    timeoutMs: z.number().int().min(1).max(600_000).default(30_000),
    followRedirects: z.boolean().default(true),
    maxRedirects: z.number().int().min(0).max(50).default(10),
    sslVerify: z.boolean().default(true),
    saveCookiesToJar: z.boolean().default(false),
  }),
  proxy: z.string().url().optional(),
}).passthrough();

export type RequestSpec = z.infer<typeof RequestSpecSchema>;

// --- Auth Schema (Postman v2.1 auth block on collections/items) ---
// D-25: 5 variants (basic, bearer, apikey, oauth2, noauth)
export const AuthSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('basic'),
    basic: z.array(z.object({
      key: z.enum(['username', 'password']),
      value: z.string(),
      type: z.literal('string'),
    })),
  }),
  z.object({
    type: z.literal('bearer'),
    bearer: z.array(z.object({
      key: z.enum(['token']),
      value: z.string(),
      type: z.literal('string'),
    })),
  }),
  z.object({
    type: z.literal('apikey'),
    apikey: z.array(z.object({
      key: z.enum(['key', 'value', 'in']),
      value: z.string(),
      type: z.literal('string'),
    })),
  }),
  z.object({
    type: z.literal('oauth2'),
    oauth2: z.array(z.object({
      key: z.string(),
      value: z.string(),
      type: z.literal('string'),
    })),
  }),
  z.object({
    type: z.literal('noauth'),
  }),
]);

export type Auth = z.infer<typeof AuthSchema>;

// --- Item Schema (a single request item in a collection) ---
export const ItemSchema = z.object({
  name: z.string(),
  request: RequestSpecSchema,
  response: z.array(z.unknown()).default([]),
  event: z.array(z.object({
    listen: z.string(),
    script: z.object({
      type: z.enum(['text/javascript']),
      exec: z.array(z.string()),
    }),
  })).default([]),
}).passthrough();

export type CollectionItem = z.infer<typeof ItemSchema>;

// --- ItemGroup Schema (a folder containing items or sub-folders) ---
// Recursive: item[] accepts both ItemSchema and ItemGroupSchema
export const ItemGroupSchema: z.ZodType<CollectionItemGroup> = z.lazy(() =>
  z.object({
    name: z.string(),
    item: z.array(z.union([ItemSchema, ItemGroupSchema])),
    description: z.string().optional(),
    variable: z.array(VariableSchema).default([]),
    auth: AuthSchema.optional(),
    event: z.array(z.unknown()).default([]),
  }).passthrough()
);

export type CollectionItemGroup = {
  name: string;
  item: Array<CollectionItem | CollectionItemGroup>;
  description?: string;
  variable?: Variable[];
  auth?: Auth;
  event?: unknown[];
  [key: string]: unknown;
};

// --- Collection Schema (Postman v2.1) ---
// D-36: Validates against Postman v2.1 schema discriminator
// D-37: Top-level 'chains' extension for Phase 4
export const CollectionSchema = z.object({
  info: z.object({
    name: z.string(),
    _postman_id: z.string().uuid(),
    description: z.string().optional(),
    schema: z.literal('https://schema.getpostman.com/json/collection/v2.1.0/collection.json'),
  }),
  item: z.array(z.union([ItemSchema, ItemGroupSchema])),
  variable: z.array(VariableSchema).default([]),
  auth: AuthSchema.optional(),
  event: z.array(z.object({
    listen: z.string(),
    script: z.object({
      type: z.enum(['text/javascript']),
      exec: z.array(z.string()),
    }),
  })).default([]),
  protocolProfileBehavior: z.record(z.string(), z.unknown()).optional(),
  // Postman v2.1 extension (postmanclone): chains always empty in v1
  chains: z.array(z.unknown()).default([]),
}).passthrough();

export type Collection = z.infer<typeof CollectionSchema>;
