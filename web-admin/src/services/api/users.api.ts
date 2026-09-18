// web-admin/src/services/api/users.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { AccountType, SafeUser } from '@/types/auth.types';
import type { AdminUpdateUserPayload, SuspendUserPayload } from '@/types/users.types';

export const usersApi = {
  /** Sert aussi à vérifier qu'un jeton stocké est toujours valide au démarrage de l'app. */
  getMe: () => api.get<SafeUser>('/users/me'),

  listAll: (params: { page?: number; limit?: number; search?: string; accountType?: AccountType }) =>
    api.get<Paginated<SafeUser>>('/users', { query: params }),

  getOne: (id: string) => api.get<SafeUser>(`/users/${id}`),

  update: (id: string, payload: AdminUpdateUserPayload) => api.patch<SafeUser>(`/users/${id}`, payload),

  suspend: (id: string, payload: SuspendUserPayload) =>
    api.patch<SafeUser>(`/users/${id}/suspend`, payload),

  unsuspend: (id: string) => api.patch<SafeUser>(`/users/${id}/unsuspend`),

  deactivate: (id: string) => api.patch<SafeUser>(`/users/${id}/deactivate`),

  activate: (id: string) => api.patch<SafeUser>(`/users/${id}/activate`),
};