import { create } from 'zustand';

export interface ResponseResult {
  requestId: string;
  status: number;
  statusText: string;
  httpVersion: string;
  headers: Array<{ key: string; value: string }>;
  bodyBase64: string;
  bodyTruncated: boolean;
  bodySizeBytes: number;
  timing: {
    dns: number;
    connect: number;
    tls: number;
    request: number;
    wait: number;
    response: number;
    total: number;
  };
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: string;
    httpOnly?: boolean;
    secure?: boolean;
  }>;
  startedAt: number;
  completedAt: number;
}

export interface ResponseError {
  code: string;
  message: string;
}

export type ResponseStatus = 'idle' | 'sending' | 'done' | 'error' | 'cancelled';

export interface ResponseState {
  status: ResponseStatus;
  result?: ResponseResult;
  error?: ResponseError;
  requestId?: string;
}

interface ResponseStore {
  responses: Record<string, ResponseState>;
  setResponse: (tabId: string, state: Partial<ResponseState>) => void;
  clearResponse: (tabId: string) => void;
}

export const useResponse = create<ResponseStore>((set) => ({
  responses: {},

  setResponse(tabId, partial) {
    set((s) => ({
      responses: {
        ...s.responses,
        [tabId]: { ...s.responses[tabId], status: 'idle' as const, ...partial },
      },
    }));
  },

  clearResponse(tabId) {
    set((s) => ({
      responses: {
        ...s.responses,
        [tabId]: { status: 'idle' as const },
      },
    }));
  },
}));
