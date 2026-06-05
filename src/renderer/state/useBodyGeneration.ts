import { create } from 'zustand';

interface GeneratedBody {
  dtoFqn: string;
  bodyJson: string;
  generatedAt: number;
  source: 'dto' | 'db';
  connectionName?: string;
  tableName?: string;
}

interface BodyGenerationState {
  generatedBodies: Record<string, GeneratedBody>;
  isGenerating: boolean;
  error: string | null;
  cacheGeneratedBody: (requestId: string, dtoFqn: string, bodyJson: string, source: 'dto' | 'db', meta?: Partial<GeneratedBody>) => void;
  getCachedBody: (requestId: string) => string | null;
  clearCache: () => void;
}

export const useBodyGeneration = create<BodyGenerationState>((set, get) => ({
  generatedBodies: {},
  isGenerating: false,
  error: null,

  cacheGeneratedBody: (requestId, dtoFqn, bodyJson, source, meta) => {
    set((s) => ({
      generatedBodies: {
        ...s.generatedBodies,
        [requestId]: { dtoFqn, bodyJson, generatedAt: Date.now(), source, ...meta },
      },
    }));
  },

  getCachedBody: (requestId) => {
    const cached = get().generatedBodies[requestId];
    return cached?.bodyJson ?? null;
  },

  clearCache: () => set({ generatedBodies: {} }),
}));
