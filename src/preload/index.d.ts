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
}
