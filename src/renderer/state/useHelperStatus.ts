import { useEffect } from 'react';
import { create } from 'zustand';

export interface HelperStatus {
  state: 'starting' | 'healthy' | 'restarting' | 'offline' | 'crashed';
  pid?: number;
  version?: string;
  attempt?: number;
  nextInMs?: number;
  reason?: string;
  since?: number;
  restartCount?: number;
}

interface HelperState {
  status: HelperStatus;
  setStatus: (status: HelperStatus) => void;
  subscribeToHelper: () => () => void;
}

export const useHelperStatus = create<HelperState>((set) => ({
  status: { state: 'starting' },

  setStatus: (status) => set({ status }),

  subscribeToHelper: () => {
    // Seed initial status
    window.api.helper.getStatus().then((s: HelperStatus) => set({ status: s }));

    // Subscribe to real-time status updates
    const unsub = window.api.helper.onStatus((s: HelperStatus) => {
      set({ status: s });
    });

    return unsub;
  },
}));

// Hook that auto-subscribes when the component mounts
export function useHelperStatusSubscription(): HelperStatus {
  const status = useHelperStatus((s) => s.status);
  const subscribeToHelper = useHelperStatus((s) => s.subscribeToHelper);

  useEffect(() => {
    const unsub = subscribeToHelper();
    return unsub;
  }, [subscribeToHelper]);

  return status;
}
