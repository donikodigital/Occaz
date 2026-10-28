// mobile/src/services/api/notifications.api.ts
// [28/10/2026] v+ — `space` (client / conducteur) : chaque espace ne liste et ne marque lues que ses propres notifications.
import { api } from './client';
import type { Paginated } from './types';
import type { AppNotification } from '@/types/notifications.types';
import type { Space } from '@/types/roles.types';

export const notificationsApi = {
  listMine: (params: { page?: number; limit?: number; space?: Space } = {}) =>
    api.get<Paginated<AppNotification>>('/notifications/mine', { query: params }),

  markRead: (id: string) => api.patch<void>(`/notifications/${id}/read`),

  markAllRead: (space?: Space) => api.patch<void>('/notifications/mine/read-all', undefined, { query: { space } }),

  remove: (id: string) => api.delete<void>(`/notifications/${id}`),

  removeMany: (ids: string[]) => api.post<void>('/notifications/mine/delete-many', { ids }),
};