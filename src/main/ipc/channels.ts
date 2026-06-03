import { z } from 'zod';

export const HelperStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('starting') }),
  z.object({ state: z.literal('healthy'), pid: z.number(), version: z.string() }),
  z.object({ state: z.literal('restarting'), attempt: z.number(), nextInMs: z.number() }),
  z.object({ state: z.literal('offline'), reason: z.string(), since: z.number() }),
  z.object({ state: z.literal('crashed'), restartCount: z.number(), reason: z.string() }),
]);

export type HelperStatus = z.infer<typeof HelperStatusSchema>;

export const AppBootstrapResultSchema = z.object({
  firstRun: z.boolean(),
  userDataPath: z.string(),
  dataDir: z.string(),
  theme: z.enum(['system', 'dark', 'light']),
  helper: HelperStatusSchema,
  jdkFound: z.boolean(),
  jdkPath: z.string().nullable(),
});

export const SetDataDirArgsSchema = z.object({ path: z.string().min(1) });
export const SetDataDirResultSchema = z.object({
  ok: z.boolean(),
  cloudSync: z.enum(['dropbox', 'onedrive', 'icloud', 'googledrive']).nullable()
});

export const ShowOpenDialogArgsSchema = z.object({
  kind: z.enum(['folder', 'file']),
  title: z.string().optional()
});
export const ShowOpenDialogResultSchema = z.object({ path: z.string().nullable() });

export const HelperGetStatusResultSchema = HelperStatusSchema;
export const HelperRestartResultSchema = HelperStatusSchema;

export const RequestDiagnoseArgsSchema = z.void();
export const RequestDiagnoseResultSchema = z.object({
  ok: z.boolean(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
  timing: z.object({
    dns: z.number(), connect: z.number(), tls: z.number(),
    request: z.number(), wait: z.number(), response: z.number(), total: z.number(),
  }),
  target: z.object({ url: z.string(), host: z.string(), port: z.number() }),
});

export const RequestSpecSchema = z.object({
  requestId: z.string().uuid(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  url: z.string().url(),
  headers: z.array(z.object({ key: z.string(), value: z.string(), enabled: z.boolean().default(true) })),
  queryParams: z.array(z.object({ key: z.string(), value: z.string(), enabled: z.boolean().default(true) })),
  pathParams: z.array(z.object({ key: z.string(), value: z.string() })),
  body: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('none') }),
    z.object({ mode: z.literal('raw'), contentType: z.enum(['application/json', 'application/xml', 'text/plain', 'application/graphql']), text: z.string() }),
    z.object({ mode: z.literal('urlencoded'), fields: z.array(z.object({ key: z.string(), value: z.string() })) }),
    z.object({ mode: z.literal('form-data'), fields: z.array(z.object({ key: z.string(), value: z.string(), type: z.enum(['text', 'file']), filePath: z.string().optional() })) }),
    z.object({ mode: z.literal('binary'), filePath: z.string(), contentType: z.string() }),
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
});

export const ResponseResultSchema = z.object({
  requestId: z.string().uuid(),
  status: z.number(),
  statusText: z.string(),
  httpVersion: z.string(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })),
  bodyBase64: z.string(),
  bodyTruncated: z.boolean(),
  bodySizeBytes: z.number(),
  timing: z.object({
    dns: z.number(), connect: z.number(), tls: z.number(),
    request: z.number(), wait: z.number(), response: z.number(), total: z.number(),
  }),
  cookies: z.array(z.object({
    name: z.string(), value: z.string(), domain: z.string().optional(),
    path: z.string().optional(), expires: z.string().optional(),
    httpOnly: z.boolean().optional(), secure: z.boolean().optional()
  })),
  startedAt: z.number(),
  completedAt: z.number(),
});

export const CancelRequestArgsSchema = z.object({ requestId: z.string().uuid() });
export const ParseCurlArgsSchema = z.object({ text: z.string() });
export const ParseCurlResultSchema = z.union([
  z.object({ ok: z.literal(true), spec: RequestSpecSchema }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);

export const ShowSaveDialogArgsSchema = z.object({
  title: z.string().optional(),
  defaultPath: z.string().optional(),
  filters: z.array(z.object({ name: z.string(), extensions: z.array(z.string()) })).optional()
});
export const ShowSaveDialogResultSchema = z.object({ path: z.string().nullable() });