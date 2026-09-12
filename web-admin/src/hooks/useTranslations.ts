// web-admin/src/hooks/useTranslations.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { translationsApi } from '@/services/api/translations.api';
import type { UpsertTranslationPayload } from '@/types/translations.types';

export function useTranslationsList(params: { page?: number; entityType?: string; locale?: string }) {
  return useQuery({
    queryKey: ['translations', params],
    queryFn: () => translationsApi.listAll({ ...params, limit: 20 }),
  });
}

export function useUpsertTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertTranslationPayload) => translationsApi.upsert(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['translations'] }),
  });
}

export function useRemoveTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { entityType: string; entityId: string; locale: string; field: string }) =>
      translationsApi.remove(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['translations'] }),
  });
}
