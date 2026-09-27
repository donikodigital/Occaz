// mobile/src/services/api/notifications.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { AppNotification } from '@/types/notifications.types';

export const notificationsApi = {
  listMine: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<AppNotification>>('/notifications/mine', { query: params }),

  markRead: (id: string) => api.patch<void>(`/notifications/${id}/read`),

  markAllRead: () => api.patch<void>('/notifications/mine/read-all'),

  remove: (id: string) => api.delete<void>(`/notifications/${id}`),

  removeMany: (ids: string[]) => api.post<void>('/notifications/mine/delete-many', { ids }),
};