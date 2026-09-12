// web-admin/src/services/api/notificationTemplates.api.ts
import { api } from './client';
import type { NotificationTemplate, UpsertNotificationTemplatePayload } from '@/types/notificationTemplates.types';

export const notificationTemplatesApi = {
  listAll: () => api.get<NotificationTemplate[]>('/notification-templates'),

  getOne: (id: string) => api.get<NotificationTemplate>(`/notification-templates/${id}`),

  create: (payload: UpsertNotificationTemplatePayload) =>
    api.post<NotificationTemplate>('/notification-templates', payload),

  update: (id: string, payload: Partial<UpsertNotificationTemplatePayload>) =>
    api.patch<NotificationTemplate>(`/notification-templates/${id}`, payload),
};
