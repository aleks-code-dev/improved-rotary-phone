import { useQuery } from '@tanstack/react-query';
import type { RequestSpec } from '../../shared/schemas/collection';

interface ResolveVariablesInput {
  spec: RequestSpec;
  activeEnvId: string | null;
  activeCollectionId: string | null;
  globals?: Array<{ key: string; value: string }>;
}

export function useResolveVariables(input: ResolveVariablesInput | null) {
  return useQuery({
    queryKey: ['variables', input?.spec?.url, input?.activeEnvId, input?.activeCollectionId],
    queryFn: () => window.api.variables.resolve({
      spec: input!.spec,
      activeEnvId: input!.activeEnvId,
      activeCollectionId: input!.activeCollectionId,
      globals: input!.globals ?? [],
    }),
    enabled: !!input,
    staleTime: 2_000,
  });
}
