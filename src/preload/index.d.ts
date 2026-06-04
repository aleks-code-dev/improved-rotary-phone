export interface WindowApi {
    app: {
        bootstrap: () => Promise<any>;
        setDataDir: (args: {
            path: string;
        }) => Promise<any>;
        showOpenDialog: (args: {
            kind: 'folder' | 'file';
            title?: string;
        }) => Promise<any>;
        showSaveDialog: (args: {
            title?: string;
            defaultPath?: string;
            filters?: Array<{
                name: string;
                extensions: string[];
            }>;
        }) => Promise<any>;
        writeFile: (args: {
            path: string;
            dataBase64: string;
        }) => Promise<any>;
    };
    helper: {
        getStatus: () => Promise<any>;
        restart: () => Promise<any>;
        onStatus: (cb: (status: any) => void) => () => void;
    };
    request: {
        diagnose: () => Promise<any>;
        send: (spec: any) => Promise<any>;
        cancel: (args: {
            requestId: string;
        }) => Promise<any>;
        parseCurl: (text: string) => Promise<any>;
        generateCurl: (spec: any) => Promise<any>;
    };
}
