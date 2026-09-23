// mobile/src/hooks/useDeleteAccount.ts
import { useMutation } from '@tanstack/react-query';
import { usersApi } from '@/services/api/users.api';

/** Refuse (400) tant qu'une réservation, un envoi ou un trajet est en cours — voir le message d'erreur renvoyé par l'API. */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (reason?: string) => usersApi.deleteMe({ reason }),
  });
}