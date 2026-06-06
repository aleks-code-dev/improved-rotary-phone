import { create } from 'zustand';

interface EndpointData {
  id: string;
  method: string;
  fullPath: string;
  handlerMethod: string;
  pathVariables: Array<{ name: string; type: string; required: boolean }>;
  queryParams: Array<{ name: string; type: string; required: boolean; defaultValue: string | null }>;
  requestBodyFqn: string | null;
  consumes: string[];
  produces: string[];
  sourceFile: string;
  lineNumber: number;
}

interface ControllerData {
  fqn: string;
  simpleName: string;
  basePath: string;
  sourceFile: string;
  endpoints: EndpointData[];
}

interface ProjectScanResult {
  ok: boolean;
  projectId: string;
  projectPath: string;
  controllers: ControllerData[];
  scanDurationMs: number;
  totalFiles: number;
  totalEndpoints: number;
  errors: string[];
  error?: string;
}

interface EndpointsState {
  activeProjectId: string | null;
  activeProjectPath: string | null;
  scanStatus: 'idle' | 'scanning' | 'error';
  lastScanError: string | null;
  lastScanResult: ProjectScanResult | null;
  selectedEndpointId: string | null;
  setActiveProject: (projectId: string | null, projectPath: string | null) => void;
  setScanStatus: (status: 'idle' | 'scanning' | 'error', error?: string) => void;
  setLastScanResult: (result: ProjectScanResult | null) => void;
  setSelectedEndpoint: (id: string | null) => void;
}

export const useEndpointsStore = create<EndpointsState>((set) => ({
  activeProjectId: null,
  activeProjectPath: null,
  scanStatus: 'idle',
  lastScanError: null,
  lastScanResult: null,
  selectedEndpointId: null,

  setActiveProject: (projectId, projectPath) => set({
    activeProjectId: projectId,
    activeProjectPath: projectPath,
  }),

  setScanStatus: (status, error) => set({
    scanStatus: status,
    lastScanError: error ?? null,
  }),

  setLastScanResult: (result) => set({ lastScanResult: result }),

  setSelectedEndpoint: (id) => set({ selectedEndpointId: id }),
}));

export type { EndpointData, ControllerData, ProjectScanResult };
