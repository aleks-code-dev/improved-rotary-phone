import { create } from 'zustand';

export interface HistoryEntrySummary {
  id: string;
  timestamp: number;
  collectionId: string;
  request: { method: string; url: string; [key: string]: unknown };
  response: { status: number; statusText: string; durationMs: number; [key: string]: unknown } | null;
}

interface HistoryStore {
  historyByCollection: Map<string, HistoryEntrySummary[]>;
  searchQuery: string;
  setSearch: (q: string) => void;
  setHistory: (collectionId: string, entries: HistoryEntrySummary[]) => void;
  appendEntry: (collectionId: string, entry: HistoryEntrySummary) => void;
  removeEntry: (collectionId: string, entryId: string) => void;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  historyByCollection: new Map(),
  searchQuery: '',

  setSearch: (q) => set({ searchQuery: q }),

  setHistory: (collectionId, entries) => {
    set((state) => {
      const byCollection = new Map(state.historyByCollection);
      byCollection.set(collectionId, entries);
      return { historyByCollection: byCollection };
    });
  },

  appendEntry: (collectionId, entry) => {
    set((state) => {
      const byCollection = new Map(state.historyByCollection);
      const existing = byCollection.get(collectionId) ?? [];
      byCollection.set(collectionId, [entry, ...existing]);
      return { historyByCollection: byCollection };
    });
  },

  removeEntry: (collectionId, entryId) => {
    set((state) => {
      const byCollection = new Map(state.historyByCollection);
      const existing = byCollection.get(collectionId) ?? [];
      byCollection.set(collectionId, existing.filter((e) => e.id !== entryId));
      return { historyByCollection: byCollection };
    });
  },
}));
