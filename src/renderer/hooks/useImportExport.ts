import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useImportPostman() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jsonText: string) => window.api.importExport.importPostman({ jsonText }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  });
}

export function useExportPostman() {
  return useMutation({
    mutationFn: ({ id }: { id: string }) => window.api.importExport.exportPostman({ id }),
  });
}
