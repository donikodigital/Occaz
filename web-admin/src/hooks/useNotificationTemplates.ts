// web-admin/src/hooks/useNotificationTemplates.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationTemplatesApi } from '@/services/api/notificationTemplates.api';
import type { UpsertNotificationTemplatePayload } from '@/types/notificationTemplates.types';

export function useNotificationTemplates() {
  return useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => notificationTemplatesApi.listAll(),
  });
}

export function useNotificationTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['notification-templates', id],
    queryFn: () => notificationTemplatesApi.getOne(id!),
    enabled: Boolean(id),
  });
}

export function useCreateNotificationTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertNotificationTemplatePayload) => notificationTemplatesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-templates'] }),
  });
}

export function useUpdateNotificationTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<UpsertNotificationTemplatePayload>) => notificationTemplatesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      queryClient.invalidateQueries({ queryKey: ['notification-templates', id] });
    },
  });
}
