// mobile/src/hooks/useNotifications.ts
// [28/10/2026] v+ — Les hooks reçoivent l'espace actif (client / conducteur) : une personne qui a les deux comptes ne voit plus dans l'un
// les notifications de l'autre. Sans espace, toute la boîte (comportement d'avant).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/services/api/notifications.api';
import type { Space } from '@/types/roles.types';

export function useMyNotifications(page = 1, space?: Space) {
  return useQuery({
    queryKey: ['notifications', 'mine', space ?? 'all', page],
    queryFn: () => notificationsApi.listMine({ page, limit: 30, space }),
    refetchInterval: 30_000,
  });
}

/**
 * Pour la carte d'alerte de l'écran d'accueil — réutilise le flux
 * notifications déjà interrogé toutes les 30 s plutôt que de construire
 * un suivi "non lu" séparé côté conversations.
 */
export function useLatestMessageAlert(space?: Space) {
  const { data } = useMyNotifications(1, space);
  return data?.data.find((n) => n.type === 'CONVERSATION_MESSAGE' && !n.readAt) ?? null;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] }),
  });
}

export function useMarkAllNotificationsRead(space?: Space) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(space),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] }),
  });
}

export function useDeleteNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    // Un seul id ou plusieurs — un seul appel bulk dans les deux cas,
    // pas besoin de distinguer suppression simple et groupée côté écran.
    mutationFn: (ids: string[]) => notificationsApi.removeMany(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] }),
  });
}
