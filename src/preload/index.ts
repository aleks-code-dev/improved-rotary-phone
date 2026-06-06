import { contextBridge, ipcRenderer } from 'electron';

export interface WindowApi {
  app: {
    bootstrap: () => Promise<any>;
    setDataDir: (args: { path: string }) => Promise<any>;
    showOpenDialog: (args: { kind: 'folder' | 'file'; title?: string }) => Promise<any>;
    showSaveDialog: (args: { title?: string; defaultPath?: string; filters?: Array<{name: string; extensions: string[]}> }) => Promise<any>;
    writeFile: (args: { path: string; dataBase64: string }) => Promise<any>;
    readFile: (args: { path: string }) => Promise<any>;
    openDataFolder: () => Promise<any>;
    confirmQuit: (args: { canQuit: boolean }) => Promise<any>;
    onQuitRequest: (cb: () => void) => () => void;
  };
  helper: {
    getStatus: () => Promise<any>;
    restart: () => Promise<any>;
    onStatus: (cb: (status: any) => void) => () => void;
  };
  request: {
    diagnose: () => Promise<any>;
    send: (spec: any) => Promise<any>;
    cancel: (args: { requestId: string }) => Promise<any>;
    parseCurl: (text: string) => Promise<any>;
    generateCurl: (spec: any) => Promise<any>;
  };
  collections: {
    list: () => Promise<any>;
    read: (args: { id: string }) => Promise<any>;
    create: (args: { name: string }) => Promise<any>;
    update: (args: { id: string; collection: any }) => Promise<any>;
    delete: (args: { id: string }) => Promise<any>;
  };
  environments: {
    list: () => Promise<any>;
    read: (args: { id: string }) => Promise<any>;
    create: (args: { name: string; values?: Array<{key: string; value: string; enabled?: boolean; secret?: boolean}>; proxy?: string }) => Promise<any>;
    update: (args: { id: string; env: any }) => Promise<any>;
    delete: (args: { id: string }) => Promise<any>;
    setActive: (args: { id: string | null }) => Promise<any>;
  };
  history: {
    list: (args: { collectionId: string; search?: string }) => Promise<any>;
    delete: (args: { collectionId: string; entryId: string }) => Promise<any>;
  };
  variables: {
    resolve: (args: { spec: any; activeEnvId: string | null; activeCollectionId: string | null; globals?: Array<{key: string; value: string}> }) => Promise<any>;
  };
  importExport: {
    importPostman: (args: { jsonText: string }) => Promise<any>;
    exportPostman: (args: { id: string }) => Promise<any>;
  };
  curl: {
    import: (args: { text: string }) => Promise<any>;
    generate: (args: { spec: any; resolvedUrl?: string }) => Promise<any>;
  };
  network: {
    diagnose: () => Promise<any>;
  };
  globals: {
    update: (args: { values: Array<{key: string; value: string}> }) => Promise<any>;
    read: () => Promise<any>;
  };
  state: {
    save: (args: { openTabs: Array<{id: string; method: string; url: string; isDirty?: boolean}>; activeTabId: string | null }) => Promise<any>;
  };
  body: {
    generateDto: (args: { requestId: string; dtoFqn: string; subtypeName?: string }) => Promise<any>;
  };
  db: {
    connections: {
      list: () => Promise<any>;
      create: (args: { name: string; url: string; user: string; password: string; dbType: string }) => Promise<any>;
      delete: (args: { id: string }) => Promise<any>;
    };
    connect: (args: { connectionId: string }) => Promise<any>;
    disconnect: (args: { connectionId: string }) => Promise<any>;
    testConnection: (args: { url: string; user: string; password: string; dbType: string }) => Promise<any>;
    listTables: (args: { connectionId: string }) => Promise<any>;
    parseJdbcUrl: (args: { url: string }) => Promise<any>;
    fetchRows: (args: { connectionId: string; tableName: string; schema?: string | null; mode: string; idValue?: string; whereClause?: string; limit?: number }) => Promise<any>;
    mapRowToDto: (args: { connectionId: string; tableName: string; rowId: Record<string, unknown>; dtoFqn: string; columnMapping?: Record<string, string> }) => Promise<any>;
  };
  chains: {
    create: (args: { collectionId: string; name?: string }) => Promise<any>;
    update: (args: { collectionId: string; chainId: string; chain: any }) => Promise<any>;
    delete: (args: { collectionId: string; chainId: string }) => Promise<any>;
    run: (args: { collectionId: string; chainId: string; startFromStep?: number }) => Promise<any>;
    stop: (args: { chainId: string }) => Promise<any>;
    validate: (args: { collectionId: string; chainId: string }) => Promise<any>;
    previewResolved: (args: { collectionId: string; chainId: string; stepIndex: number }) => Promise<any>;
    onProgress: (cb: (data: any) => void) => () => void;
    onStepResult: (cb: (data: any) => void) => () => void;
    onComplete: (cb: (data: any) => void) => () => void;
    onValidationFailed: (cb: (data: any) => void) => () => void;
  };
}

const api: WindowApi = {
  app: {
    bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
    setDataDir: (args) => ipcRenderer.invoke('app:setDataDir', args),
    showOpenDialog: (args) => ipcRenderer.invoke('app:showOpenDialog', args),
    showSaveDialog: (args) => ipcRenderer.invoke('app:showSaveDialog', args),
    writeFile: (args) => ipcRenderer.invoke('app:writeFile', args),
    readFile: (args) => ipcRenderer.invoke('app:readFile', args),
    openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
    confirmQuit: (args) => ipcRenderer.invoke('app:confirmQuit', args),
    onQuitRequest: (cb) => {
      const listener = () => cb();
      ipcRenderer.on('app:quitRequest', listener);
      return () => ipcRenderer.off('app:quitRequest', listener);
    },
  },
  helper: {
    getStatus: () => ipcRenderer.invoke('helper:getStatus'),
    restart: () => ipcRenderer.invoke('helper:restart'),
    onStatus: (cb) => {
      const listener = (_: any, s: any) => cb(s);
      ipcRenderer.on('helper:status', listener);
      return () => ipcRenderer.off('helper:status', listener);
    },
  },
  request: {
    diagnose: () => ipcRenderer.invoke('request:diagnose'),
    send: (spec) => ipcRenderer.invoke('request:send', spec),
    cancel: (args) => ipcRenderer.invoke('request:cancel', args),
    parseCurl: (text) => ipcRenderer.invoke('request:parseCurl', text),
    generateCurl: (spec) => ipcRenderer.invoke('request:generateCurl', spec),
  },
  collections: {
    list: () => ipcRenderer.invoke('collections:list'),
    read: (args) => ipcRenderer.invoke('collections:read', args),
    create: (args) => ipcRenderer.invoke('collections:create', args),
    update: (args) => ipcRenderer.invoke('collections:update', args),
    delete: (args) => ipcRenderer.invoke('collections:delete', args),
  },
  environments: {
    list: () => ipcRenderer.invoke('environments:list'),
    read: (args) => ipcRenderer.invoke('environments:read', args),
    create: (args) => ipcRenderer.invoke('environments:create', args),
    update: (args) => ipcRenderer.invoke('environments:update', args),
    delete: (args) => ipcRenderer.invoke('environments:delete', args),
    setActive: (args) => ipcRenderer.invoke('environments:setActive', args),
  },
  history: {
    list: (args) => ipcRenderer.invoke('history:list', args),
    append: (args) => ipcRenderer.invoke('history:append', args),
    delete: (args) => ipcRenderer.invoke('history:delete', args),
  },
  variables: {
    resolve: (args) => ipcRenderer.invoke('variables:resolve', args),
  },
  importExport: {
    importPostman: (args) => ipcRenderer.invoke('importExport:importPostman', args),
    exportPostman: (args) => ipcRenderer.invoke('importExport:exportPostman', args),
  },
  curl: {
    import: (args) => ipcRenderer.invoke('curl:import', args),
    generate: (args) => ipcRenderer.invoke('curl:generate', args),
  },
  network: {
    diagnose: () => ipcRenderer.invoke('network:diagnose'),
  },
  globals: {
    update: (args) => ipcRenderer.invoke('globals:update', args),
    read: () => ipcRenderer.invoke('globals:read'),
  },
  state: {
    save: (args) => ipcRenderer.invoke('state:save', args),
  },
  body: {
    generateDto: (args) => ipcRenderer.invoke('body:generateDto', args),
  },
  db: {
    connections: {
      list: () => ipcRenderer.invoke('db:connections:list'),
      create: (args) => ipcRenderer.invoke('db:connections:create', args),
      delete: (args) => ipcRenderer.invoke('db:connections:delete', args),
    },
    connect: (args) => ipcRenderer.invoke('db:connect', args),
    disconnect: (args) => ipcRenderer.invoke('db:disconnect', args),
    testConnection: (args) => ipcRenderer.invoke('db:testConnection', args),
    listTables: (args) => ipcRenderer.invoke('db:listTables', args),
    parseJdbcUrl: (args) => ipcRenderer.invoke('db:parseJdbcUrl', args),
    fetchRows: (args) => ipcRenderer.invoke('db:fetchRows', args),
    mapRowToDto: (args) => ipcRenderer.invoke('db:mapRowToDto', args),
  },
  chains: {
    create: (args) => ipcRenderer.invoke('chains:create', args),
    update: (args) => ipcRenderer.invoke('chains:update', args),
    delete: (args) => ipcRenderer.invoke('chains:delete', args),
    run: (args) => ipcRenderer.invoke('chains:run', args),
    stop: (args) => ipcRenderer.invoke('chains:stop', args),
    validate: (args) => ipcRenderer.invoke('chains:validate', args),
    previewResolved: (args) => ipcRenderer.invoke('chains:previewResolved', args),
    onProgress: (cb) => {
      const listener = (_: any, data: any) => cb(data);
      ipcRenderer.on('chains:progress', listener);
      return () => ipcRenderer.off('chains:progress', listener);
    },
    onStepResult: (cb) => {
      const listener = (_: any, data: any) => cb(data);
      ipcRenderer.on('chains:stepResult', listener);
      return () => ipcRenderer.off('chains:stepResult', listener);
    },
    onComplete: (cb) => {
      const listener = (_: any, data: any) => cb(data);
      ipcRenderer.on('chains:complete', listener);
      return () => ipcRenderer.off('chains:complete', listener);
    },
    onValidationFailed: (cb) => {
      const listener = (_: any, data: any) => cb(data);
      ipcRenderer.on('chains:validationFailed', listener);
      return () => ipcRenderer.off('chains:validationFailed', listener);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);
