import { create } from 'zustand';

export interface DbSelectedRow {
  row: Record<string, unknown>;
  schema: string | null;
}

export interface DbSelectionState {
  selectedConnectionId: string | null;
  selectedTableName: string | null;
  selectedRow: DbSelectedRow | null;
  setSelection: (sel: Partial<Pick<DbSelectionState, 'selectedConnectionId' | 'selectedTableName' | 'selectedRow'>>) => void;
  clear: () => void;
}

export const useDbSelection = create<DbSelectionState>((set) => ({
  selectedConnectionId: null,
  selectedTableName: null,
  selectedRow: null,
  setSelection: (sel) => set((s) => ({ ...s, ...sel })),
  clear: () => set({ selectedConnectionId: null, selectedTableName: null, selectedRow: null }),
}));
