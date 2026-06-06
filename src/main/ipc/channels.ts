import { z } from 'zod';

export const HelperStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('starting') }),
  z.object({ state: z.literal('healthy'), pid: z.number(), version: z.string() }),
  z.object({ state: z.literal('restarting'), attempt: z.number(), nextInMs: z.number() }),
  z.object({ state: z.literal('offline'), reason: z.string(), since: z.number() }),
  z.object({ state: z.literal('crashed'), restartCount: z.number(), reason: z.string() }),
]);

export const AppBootstrapResultSchema = z.object({
  firstRun: z.boolean(),
  userDataPath: z.string(),
  dataDir: z.string(),
  theme: z.enum(['system', 'dark', 'light']),
  helper: HelperStatusSchema,
  jdkFound: z.boolean(),
  jdkPath: z.string().nullable(),
  lastSpringProjectPath: z.string().nullable().optional(),
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
  url: z.string(),
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

export const WriteFileArgsSchema = z.object({
  path: z.string().min(1),
  dataBase64: z.string(),
});
export const WriteFileResultSchema = z.object({ ok: z.boolean() });

// --- 01-03: Collections schemas ---
export const CollectionsListResultSchema = z.array(z.object({
  id: z.string().uuid(),
  name: z.string(),
  itemCount: z.number().default(0),
  info: z.object({ name: z.string(), _postman_id: z.string() }),
}));

export const CollectionReadArgsSchema = z.object({ id: z.string().uuid() });
export const CollectionCreateArgsSchema = z.object({ name: z.string().min(1).max(200) });
export const CollectionCreateResultSchema = z.object({ id: z.string().uuid() });
export const CollectionUpdateArgsSchema = z.object({ id: z.string().uuid(), collection: z.any() });
export const CollectionDeleteArgsSchema = z.object({ id: z.string().uuid() });

// --- 01-03: Environments schemas ---
export const EnvironmentsListResultSchema = z.array(z.object({
  id: z.string().uuid(),
  name: z.string(),
  active: z.boolean(),
}));

export const EnvironmentReadArgsSchema = z.object({ id: z.string().uuid() });
export const EnvironmentCreateArgsSchema = z.object({
  name: z.string().min(1),
  values: z.array(z.object({
    key: z.string(), value: z.string(),
    enabled: z.boolean().default(true), secret: z.boolean().default(false),
  })).default([]),
  proxy: z.string().url().optional(),
});
export const EnvironmentCreateResultSchema = z.object({ id: z.string().uuid() });
export const EnvironmentUpdateArgsSchema = z.object({ id: z.string().uuid(), env: z.any() });
export const EnvironmentDeleteArgsSchema = z.object({ id: z.string().uuid() });
export const EnvironmentSetActiveArgsSchema = z.object({ id: z.string().uuid().nullable() });

// --- 01-03: History schemas ---
export const HistoryListArgsSchema = z.object({
  collectionId: z.string(),
  search: z.string().optional(),
});
export const HistoryListResultSchema = z.array(z.any());
export const HistoryAppendArgsSchema = z.object({
  collectionId: z.string(),
  timestamp: z.number(),
  request: z.object({
    method: z.string(),
    url: z.string(),
  }).passthrough(),
  response: z.object({
    status: z.number(),
    statusText: z.string(),
    durationMs: z.number(),
  }).passthrough().nullable().optional(),
});
export const HistoryDeleteArgsSchema = z.object({
  collectionId: z.string().uuid(),
  entryId: z.string().uuid(),
});

// --- 01-03: Variables schemas ---
export const VariablesResolveArgsSchema = z.object({
  spec: RequestSpecSchema,
  activeEnvId: z.string().uuid().nullable(),
  activeCollectionId: z.string().uuid().nullable(),
  globals: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
});
export const VariablesResolveResultSchema = z.object({
  resolved: RequestSpecSchema,
  unresolved: z.array(z.string()),
});

// --- 01-03: Import/Export schemas ---
export const ImportPostmanArgsSchema = z.object({ jsonText: z.string() });
export const ImportPostmanResultSchema = z.object({
  id: z.string().uuid(),
  preview: z.object({ itemCount: z.number(), folderCount: z.number() }),
});
export const ExportPostmanArgsSchema = z.object({ id: z.string().uuid() });
export const ExportPostmanResultSchema = z.object({ json: z.string() });

// --- 01-03: cURL schemas ---
export const CurlImportArgsSchema = z.object({ text: z.string() });
export const CurlImportResultSchema = z.union([
  z.object({ ok: z.literal(true), spec: RequestSpecSchema }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
export const CurlGenerateArgsSchema = z.object({
  spec: RequestSpecSchema,
  resolvedUrl: z.string().optional(),
});
export const CurlGenerateResultSchema = z.object({ curl: z.string() });

// --- 01-03: Network diagnose result (reuse from 01-01) ---
export const NetworkDiagnoseResultSchema = RequestDiagnoseResultSchema;

// --- 01-03: State save schemas ---
export const StateSaveArgsSchema = z.object({
  openTabs: z.array(z.object({
    id: z.string(), method: z.string(), url: z.string(),
    isDirty: z.boolean().default(false),
  })),
  activeTabId: z.string().nullable(),
});

// --- 01-03: Quit confirmation schemas ---
export const ConfirmQuitArgsSchema = z.object({ canQuit: z.boolean() });

// --- 01-03: Globals schemas ---
export const GlobalsUpdateArgsSchema = z.object({
  values: z.array(z.object({
    key: z.string().min(1).max(200),
    value: z.string(),
  })),
});

// --- 01-03: Read file schemas ---
export const ReadFileArgsSchema = z.object({ path: z.string().min(1) });

// --- 03-01: Body generation schemas ---
export const DtoGenerateArgsSchema = z.object({
  requestId: z.string().uuid(),
  dtoFqn: z.string().min(1),
  subtypeName: z.string().optional(),
});
export const DtoGenerateResultSchema = z.object({
  ok: z.boolean(),
  bodyJson: z.string(),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })).default([]),
  cycleRefs: z.array(z.string()).default([]),
});
export type DtoGenerateArgs = z.infer<typeof DtoGenerateArgsSchema>;
export type DtoGenerateResult = z.infer<typeof DtoGenerateResultSchema>;

// --- 03-02: DB Connection schemas ---
export const DbConnectionCreateArgsSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().min(1),
  user: z.string(),
  password: z.string(),
  dbType: z.enum(['postgresql', 'mysql', 'oracle', 'h2']),
});
export const DbConnectionDeleteArgsSchema = z.object({
  id: z.string().uuid(),
});
export const DbConnectionListResultSchema = z.array(z.object({
  id: z.string().uuid(),
  name: z.string(),
  dbType: z.string(),
  connected: z.boolean().default(false),
}));

export const DbConnectArgsSchema = z.object({
  connectionId: z.string().uuid(),
});
export const DbConnectResultSchema = z.object({
  ok: z.boolean(),
  status: z.enum(['connected', 'error']),
  error: z.string().optional(),
  tables: z.number().optional(),
});

export const DbDisconnectArgsSchema = z.object({
  connectionId: z.string().uuid(),
});

export const DbTestConnectionArgsSchema = z.object({
  url: z.string().min(1),
  user: z.string(),
  password: z.string(),
  dbType: z.enum(['postgresql', 'mysql', 'oracle', 'h2']),
});
export const DbTestConnectionResultSchema = z.object({
  ok: z.boolean(),
  connected: z.boolean(),
  latencyMs: z.number().optional(),
  error: z.string().optional(),
});

export const DbListTablesArgsSchema = z.object({
  connectionId: z.string().uuid(),
});
export const DbTableInfoSchema = z.object({
  name: z.string(),
  schema: z.string().nullable(),
  columnCount: z.number(),
  rowCountEstimate: z.number(),
});
export const DbListTablesResultSchema = z.array(DbTableInfoSchema);

export const DbParseJdbcUrlArgsSchema = z.object({
  url: z.string().min(1),
});
export const DbParseJdbcUrlResultSchema = z.object({
  driver: z.string().nullable(),
  host: z.string().nullable(),
  port: z.number().nullable(),
  database: z.string().nullable(),
  raw: z.string(),
});

export type DbConnectionCreateArgs = z.infer<typeof DbConnectionCreateArgsSchema>;
export type DbConnectionDeleteArgs = z.infer<typeof DbConnectionDeleteArgsSchema>;
export type DbConnectionListResult = z.infer<typeof DbConnectionListResultSchema>;
export type DbConnectArgs = z.infer<typeof DbConnectArgsSchema>;
export type DbConnectResult = z.infer<typeof DbConnectResultSchema>;
export type DbDisconnectArgs = z.infer<typeof DbDisconnectArgsSchema>;
export type DbTestConnectionArgs = z.infer<typeof DbTestConnectionArgsSchema>;
export type DbTestConnectionResult = z.infer<typeof DbTestConnectionResultSchema>;
export type DbListTablesArgs = z.infer<typeof DbListTablesArgsSchema>;
export type DbListTablesResult = z.infer<typeof DbListTablesResultSchema>;
export type DbParseJdbcUrlArgs = z.infer<typeof DbParseJdbcUrlArgsSchema>;
export type DbParseJdbcUrlResult = z.infer<typeof DbParseJdbcUrlResultSchema>;

// --- 03-03: DB fetch rows + map row to DTO schemas ---
export const DbFetchRowsArgsSchema = z.object({
  connectionId: z.string().uuid(),
  tableName: z.string(),
  schema: z.string().nullable(),
  mode: z.enum(['firstN', 'byId', 'byWhere']),
  idValue: z.string().optional(),
  whereClause: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(100),
});
export const DbFetchRowsResultSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  columns: z.array(z.object({
    name: z.string(),
    typeName: z.string(),
    nullable: z.boolean(),
  })),
  truncated: z.boolean(),
  totalCount: z.number(),
});

export const DbMapRowToDtoArgsSchema = z.object({
  connectionId: z.string().uuid(),
  tableName: z.string(),
  rowId: z.record(z.string(), z.unknown()),
  dtoFqn: z.string(),
  columnMapping: z.record(z.string(), z.string()).default({}),
});
export const DbMapRowToDtoResultSchema = z.object({
  ok: z.boolean(),
  bodyJson: z.string(),
  mapping: z.array(z.object({
    column: z.string(),
    field: z.string(),
    compatibility: z.enum(['exact', 'compatible', 'incompatible']),
  })),
  coverage: z.object({
    mapped: z.number(),
    required: z.number(),
    total: z.number(),
  }),
  warnings: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })).default([]),
});

export type DbFetchRowsArgs = z.infer<typeof DbFetchRowsArgsSchema>;
export type DbFetchRowsResult = z.infer<typeof DbFetchRowsResultSchema>;
export type DbMapRowToDtoArgs = z.infer<typeof DbMapRowToDtoArgsSchema>;
export type DbMapRowToDtoResult = z.infer<typeof DbMapRowToDtoResultSchema>;

// --- 04-01: Chain CRUD schemas ---
export const ChainCreateArgsSchema = z.object({
  collectionId: z.string().uuid(),
  name: z.string().min(1).max(200).default('New Chain'),
});
export const ChainCreateResultSchema = z.object({
  chainId: z.string().uuid(),
});

export const ChainUpdateArgsSchema = z.object({
  collectionId: z.string().uuid(),
  chainId: z.string().uuid(),
  chain: z.any(),
});

export const ChainDeleteArgsSchema = z.object({
  collectionId: z.string().uuid(),
  chainId: z.string().uuid(),
});

// --- 04-01: Chain execution schemas ---
export const ChainRunArgsSchema = z.object({
  collectionId: z.string().uuid(),
  chainId: z.string().uuid(),
  startFromStep: z.number().int().min(1).optional(),
});
export const ChainRunResultSchema = z.object({
  chainId: z.string().uuid(),
  status: z.enum(['completed', 'failed', 'stopped']),
  steps: z.array(z.object({
    stepIndex: z.number(),
    status: z.enum(['success', 'failed', 'stopped', 'skipped']),
    response: z.any().optional(),
    error: z.string().optional(),
    unresolvedRefs: z.array(z.string()),
    retryAttempts: z.number(),
  })),
});

export const ChainStopArgsSchema = z.object({
  chainId: z.string().uuid(),
});

// --- 04-01: Chain validation schema ---
export const ChainValidateArgsSchema = z.object({
  collectionId: z.string().uuid(),
  chainId: z.string().uuid(),
});
export const ChainValidateResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.object({
    type: z.string(),
    message: z.string(),
    stepIndex: z.number().optional(),
  })),
});

// --- 04-01: Preview resolved schema ---
export const ChainPreviewResolvedArgsSchema = z.object({
  collectionId: z.string().uuid(),
  chainId: z.string().uuid(),
  stepIndex: z.number().int().min(1),
});
export const ChainPreviewResolvedResultSchema = z.object({
  resolvedUrl: z.string(),
  resolvedHeaders: z.array(z.object({ key: z.string(), value: z.string() })),
  resolvedBody: z.string(),
  warnings: z.array(z.object({
    reference: z.string(),
    reason: z.string(),
  })),
});

// --- 02-01: Project scanning schemas ---
export const ProjectScanArgsSchema = z.object({
  path: z.string().min(1),
});

export const EndpointSchema = z.object({
  id: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  fullPath: z.string(),
  handlerMethod: z.string(),
  pathVariables: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
  })),
  queryParams: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    defaultValue: z.string().nullable(),
  })),
  requestBodyFqn: z.string().nullable(),
  consumes: z.array(z.string()),
  produces: z.array(z.string()),
  sourceFile: z.string(),
  lineNumber: z.number(),
});

export const ControllerSchema = z.object({
  fqn: z.string(),
  simpleName: z.string(),
  basePath: z.string(),
  sourceFile: z.string(),
  endpoints: z.array(EndpointSchema),
});

export const ProjectScanResultSchema = z.object({
  ok: z.boolean(),
  projectId: z.string(),
  projectPath: z.string(),
  controllers: z.array(ControllerSchema),
  scanDurationMs: z.number(),
  totalFiles: z.number(),
  totalEndpoints: z.number(),
  errors: z.array(z.string()),
  error: z.string().optional(),
});

export const ProjectEndpointsArgsSchema = z.object({
  projectId: z.string(),
});

export const ProjectEndpointsResultSchema = ProjectScanResultSchema;

// Inferred types for all schemas
export type HelperStatus = z.infer<typeof HelperStatusSchema>;
export type AppBootstrapResult = z.infer<typeof AppBootstrapResultSchema>;
export type SetDataDirArgs = z.infer<typeof SetDataDirArgsSchema>;
export type SetDataDirResult = z.infer<typeof SetDataDirResultSchema>;
export type ShowOpenDialogArgs = z.infer<typeof ShowOpenDialogArgsSchema>;
export type ShowOpenDialogResult = z.infer<typeof ShowOpenDialogResultSchema>;
export type RequestDiagnoseResult = z.infer<typeof RequestDiagnoseResultSchema>;
export type RequestSpec = z.infer<typeof RequestSpecSchema>;
export type ResponseResult = z.infer<typeof ResponseResultSchema>;
export type CancelRequestArgs = z.infer<typeof CancelRequestArgsSchema>;
export type ParseCurlArgs = z.infer<typeof ParseCurlArgsSchema>;
export type ParseCurlResult = z.infer<typeof ParseCurlResultSchema>;
export type ShowSaveDialogArgs = z.infer<typeof ShowSaveDialogArgsSchema>;
export type ShowSaveDialogResult = z.infer<typeof ShowSaveDialogResultSchema>;
export type WriteFileArgs = z.infer<typeof WriteFileArgsSchema>;
export type WriteFileResult = z.infer<typeof WriteFileResultSchema>;

// 01-03 types
export type CollectionsListResult = z.infer<typeof CollectionsListResultSchema>;
export type CollectionReadArgs = z.infer<typeof CollectionReadArgsSchema>;
export type CollectionCreateArgs = z.infer<typeof CollectionCreateArgsSchema>;
export type CollectionCreateResult = z.infer<typeof CollectionCreateResultSchema>;
export type CollectionUpdateArgs = z.infer<typeof CollectionUpdateArgsSchema>;
export type CollectionDeleteArgs = z.infer<typeof CollectionDeleteArgsSchema>;
export type EnvironmentsListResult = z.infer<typeof EnvironmentsListResultSchema>;
export type EnvironmentReadArgs = z.infer<typeof EnvironmentReadArgsSchema>;
export type EnvironmentCreateArgs = z.infer<typeof EnvironmentCreateArgsSchema>;
export type EnvironmentCreateResult = z.infer<typeof EnvironmentCreateResultSchema>;
export type EnvironmentUpdateArgs = z.infer<typeof EnvironmentUpdateArgsSchema>;
export type EnvironmentDeleteArgs = z.infer<typeof EnvironmentDeleteArgsSchema>;
export type EnvironmentSetActiveArgs = z.infer<typeof EnvironmentSetActiveArgsSchema>;
export type HistoryListArgs = z.infer<typeof HistoryListArgsSchema>;
export type HistoryDeleteArgs = z.infer<typeof HistoryDeleteArgsSchema>;
export type VariablesResolveArgs = z.infer<typeof VariablesResolveArgsSchema>;
export type VariablesResolveResult = z.infer<typeof VariablesResolveResultSchema>;
export type ImportPostmanArgs = z.infer<typeof ImportPostmanArgsSchema>;
export type ImportPostmanResult = z.infer<typeof ImportPostmanResultSchema>;
export type ExportPostmanArgs = z.infer<typeof ExportPostmanArgsSchema>;
export type ExportPostmanResult = z.infer<typeof ExportPostmanResultSchema>;
export type CurlImportArgs = z.infer<typeof CurlImportArgsSchema>;
export type CurlImportResult = z.infer<typeof CurlImportResultSchema>;
export type CurlGenerateArgs = z.infer<typeof CurlGenerateArgsSchema>;
export type CurlGenerateResult = z.infer<typeof CurlGenerateResultSchema>;
export type StateSaveArgs = z.infer<typeof StateSaveArgsSchema>;
export type ConfirmQuitArgs = z.infer<typeof ConfirmQuitArgsSchema>;
export type GlobalsUpdateArgs = z.infer<typeof GlobalsUpdateArgsSchema>;
export type ReadFileArgs = z.infer<typeof ReadFileArgsSchema>;

// 04-01 types
export type ChainCreateArgs = z.infer<typeof ChainCreateArgsSchema>;
export type ChainCreateResult = z.infer<typeof ChainCreateResultSchema>;
export type ChainUpdateArgs = z.infer<typeof ChainUpdateArgsSchema>;
export type ChainDeleteArgs = z.infer<typeof ChainDeleteArgsSchema>;
export type ChainRunArgs = z.infer<typeof ChainRunArgsSchema>;
export type ChainRunResult = z.infer<typeof ChainRunResultSchema>;
export type ChainStopArgs = z.infer<typeof ChainStopArgsSchema>;
export type ChainValidateArgs = z.infer<typeof ChainValidateArgsSchema>;
export type ChainValidateResult = z.infer<typeof ChainValidateResultSchema>;
export type ChainPreviewResolvedArgs = z.infer<typeof ChainPreviewResolvedArgsSchema>;
export type ChainPreviewResolvedResult = z.infer<typeof ChainPreviewResolvedResultSchema>;

// 02-01 types
export type ProjectScanArgs = z.infer<typeof ProjectScanArgsSchema>;
export type ProjectScanResult = z.infer<typeof ProjectScanResultSchema>;
export type Endpoint = z.infer<typeof EndpointSchema>;
export type Controller = z.infer<typeof ControllerSchema>;