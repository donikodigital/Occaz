// mobile/src/services/api/users.api.ts
import { api } from './client';
import type { SafeUser } from '@/types/auth.types';

export const usersApi = {
  /** Sert aussi à vérifier qu'un jeton stocké est toujours valide au démarrage de l'app. */
  getMe: () => api.get<SafeUser>('/users/me'),

  updateMe: (payload: { email?: string }) => api.patch<SafeUser>('/users/me', payload),
};
