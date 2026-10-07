// web-admin/src/services/api/notifications.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { InboxNotification } from '@/types/notifications.types';

export const notificationsApi = {
  listMine: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<InboxNotification>>('/notifications/mine', { query: params }),

  unreadCount: () => api.get<{ count: number }>('/notifications/mine/unread-count'),

  markRead: (id: string) => api.patch<void>(`/notifications/${id}/read`),

  markAllRead: () => api.patch<void>('/notifications/mine/read-all'),

  remove: (id: string) => api.delete<void>(`/notifications/${id}`),

  removeAll: () => api.post<void>('/notifications/mine/delete-all'),
};
