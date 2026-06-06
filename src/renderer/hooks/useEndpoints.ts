import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEndpointsStore } from '../store/endpoints';

export function useEndpointsList() {
  const activeProjectId = useEndpointsStore((s) => s.activeProjectId);
  const setLastScanResult = useEndpointsStore((s) => s.setLastScanResult);

  return useQuery({
    queryKey: ['endpoints', activeProjectId],
    queryFn: async () => {
      const result = await window.api.project.endpoints({ projectId: activeProjectId! });
      setLastScanResult(result);
      return result;
    },
    enabled: !!activeProjectId,
    staleTime: 30_000,
  });
}

export function useEndpointsScan() {
  const queryClient = useQueryClient();
  const setScanStatus = useEndpointsStore((s) => s.setScanStatus);
  const setActiveProject = useEndpointsStore((s) => s.setActiveProject);
  const setLastScanResult = useEndpointsStore((s) => s.setLastScanResult);

  return useMutation({
    mutationFn: async (path: string) => {
      const result = await window.api.project.scan({ path });
      return result;
    },
    onMutate: () => {
      setScanStatus('scanning');
    },
    onSuccess: (result) => {
      if (result.ok) {
        setActiveProject(result.projectId, result.projectPath);
        setLastScanResult(result);
        setScanStatus('idle');
      } else {
        setScanStatus('error', result.error || 'Scan returned no results');
        setLastScanResult(result);
      }
      queryClient.invalidateQueries({ queryKey: ['endpoints'] });
    },
    onError: (err: Error) => {
      setScanStatus('error', err.message);
    },
  });
}
