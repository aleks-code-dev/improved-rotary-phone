import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useHistoryStore } from '../store/history';

export function useHistoryList(collectionId: string | null, search?: string) {
  const setHistory = useHistoryStore((s) => s.setHistory);

  return useQuery({
    queryKey: ['history', collectionId, search],
    queryFn: async () => {
      if (!collectionId) return [];
      const result = await window.api.history.list({ collectionId, search });
      setHistory(collectionId, result);
      return result;
    },
    enabled: !!collectionId,
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
