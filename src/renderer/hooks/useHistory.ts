import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useHistoryStore } from '../store/history';

export function useHistoryList(collectionId: string | null, search?: string) {
  const setHistory = useHistoryStore((s) => s.setHistory);
  const effectiveCollectionId = collectionId || '__global__';

  return useQuery({
    queryKey: ['history', effectiveCollectionId, search],
    queryFn: async () => {
      const result = await window.api.history.list({ collectionId: effectiveCollectionId, search });
      setHistory(effectiveCollectionId, result);
      return result;
    },
    enabled: true,
  });
}

export function useDeleteHistoryEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, entryId }: { collectionId: string; entryId: string }) =>
      window.api.history.delete({ collectionId, entryId }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['history', vars.collectionId] }),
  });
}
