// mobile/src/services/api/users.api.ts
// [22/09/2026] v+ — deleteMe() pour la suppression de compte en libre-service.
import { api } from './client';
import type { SafeUser } from '@/types/auth.types';

export const usersApi = {
  /** Sert aussi à vérifier qu'un jeton stocké est toujours valide au démarrage de l'app. */
  getMe: () => api.get<SafeUser>('/users/me'),

  updateMe: (payload: { email?: string }) => api.patch<SafeUser>('/users/me', payload),

  /** Refuse tant qu'une réservation, un envoi ou un trajet est en cours — voir le message d'erreur renvoyé. */
  deleteMe: (payload: { reason?: string } = {}) => api.post<SafeUser>('/users/me/delete', payload),
};