import { create } from 'zustand';

interface ChainProgress {
  stepIndex: number;
  totalSteps: number;
  status: string;
}

interface ChainValidationIssue {
  type: string;
  message: string;
  stepIndex?: number;
}

interface ChainState {
  activeChainId: string | null;
  activeCollectionId: string | null;
  selectedStepIndex: number;
  isRunning: boolean;
  isStopping: boolean;
  progress: ChainProgress | null;
  stepResults: Map<number, any>;
  validationIssues: ChainValidationIssue[] | null;

  openChain: (collectionId: string, chainId: string) => void;
  closeChain: () => void;
  selectStep: (stepIndex: number) => void;
  setRunning: (running: boolean) => void;
  setStopping: (stopping: boolean) => void;
  updateProgress: (data: ChainProgress) => void;
  updateStepResult: (data: { stepIndex: number; result: any }) => void;
  setComplete: (data: { chainId: string; status: string }) => void;
  setValidationFailed: (data: { chainId: string; issues: ChainValidationIssue[] }) => void;
  clearValidation: () => void;
  reset: () => void;
}

const initialState = {
  activeChainId: null,
  activeCollectionId: null,
  selectedStepIndex: 1,
  isRunning: false,
  isStopping: false,
  progress: null,
  stepResults: new Map<number, any>(),
  validationIssues: null,
};

export const useChain = create<ChainState>((set, get) => ({
  ...initialState,

  openChain: (collectionId: string, chainId: string) => set({
    activeChainId: chainId,
    activeCollectionId: collectionId,
    selectedStepIndex: 1,
    stepResults: new Map(),
    validationIssues: null,
  }),

  closeChain: () => set(initialState),

  selectStep: (stepIndex: number) => set({ selectedStepIndex: stepIndex }),

  setRunning: (running: boolean) => set({ isRunning: running, isStopping: false }),

  setStopping: (stopping: boolean) => set({ isStopping: stopping }),

  updateProgress: (data: ChainProgress) => set({ progress: data }),

  updateStepResult: (data: { stepIndex: number; result: any }) => set((state) => {
    const next = new Map(state.stepResults);
    next.set(data.stepIndex, data.result);
    return { stepResults: next };
  }),

  setComplete: (_data: { chainId: string; status: string }) => set({
    isRunning: false,
    isStopping: false,
    progress: null,
  }),

  setValidationFailed: (data: { chainId: string; issues: ChainValidationIssue[] }) => set({
    validationIssues: data.issues,
  }),

  clearValidation: () => set({ validationIssues: null }),

  reset: () => set(initialState),
}));
