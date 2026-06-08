import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCollectionsStore } from '../store/collections';

export function useCollectionsList() {
  const setCollections = useCollectionsStore((s) => s.setCollections);

  return useQuery({
    queryKey: ['collections'],
    queryFn: async () => {
      const result = await window.api.collections.list();
      setCollections(result);
      return result;
    },
    staleTime: 5_000,
  });
}

export function useCollection(id: string | null) {
  return useQuery({
    queryKey: ['collections', id],
    queryFn: () => window.api.collections.read({ id: id! }),
    enabled: !!id,
    staleTime: 5_000,
  });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => window.api.collections.create({ name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, collection }: { id: string; collection: any }) =>
      window.api.collections.update({ id, collection }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['collections'] });
      qc.invalidateQueries({ queryKey: ['collections', vars.id] });
    },
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => window.api.collections.delete({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  });
}
