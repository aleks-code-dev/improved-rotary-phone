import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEnvironmentsStore } from '../store/environments';

export function useEnvironmentsList() {
  const setEnvironments = useEnvironmentsStore((s) => s.setEnvironments);

  return useQuery({
    queryKey: ['environments'],
    queryFn: async () => {
      const result = await window.api.environments.list();
      setEnvironments(result);
      return result;
    },
    staleTime: 5_000,
  });
}

export function useEnvironment(id: string | null) {
  return useQuery({
    queryKey: ['environments', id],
    queryFn: () => window.api.environments.read({ id: id! }),
    enabled: !!id,
    staleTime: 5_000,
  });
}

export function useCreateEnv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { name: string; values?: Array<{ key: string; value: string; enabled?: boolean; secret?: boolean }>; proxy?: string }) =>
      window.api.environments.create(args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  });
}

export function useUpdateEnv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, env }: { id: string; env: any }) =>
      window.api.environments.update({ id, env }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['environments', vars.id] }),
  });
}

export function useDeleteEnv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => window.api.environments.delete({ id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  });
}

export function useSetActiveEnv() {
  const qc = useQueryClient();
  const setActiveEnv = useEnvironmentsStore((s) => s.setActiveEnv);
  return useMutation({
    mutationFn: (id: string | null) => {
      setActiveEnv(id);
      return window.api.environments.setActive({ id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['environments'] }),
  });
}
