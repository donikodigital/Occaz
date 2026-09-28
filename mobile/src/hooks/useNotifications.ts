// mobile/src/hooks/useNotifications.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/services/api/notifications.api';

export function useMyNotifications(page = 1) {
  return useQuery({
    queryKey: ['notifications', 'mine', page],
    queryFn: () => notificationsApi.listMine({ page, limit: 30 }),
    refetchInterval: 30_000,
  });
}

/**
 * Pour la carte d'alerte de l'écran d'accueil — réutilise le flux
 * notifications déjà interrogé toutes les 30 s plutôt que de construire
 * un suivi "non lu" séparé côté conversations.
 */
export function useLatestMessageAlert() {
  const { data } = useMyNotifications(1);
  return data?.data.find((n) => n.type === 'CONVERSATION_MESSAGE' && !n.readAt) ?? null;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'mine'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
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
