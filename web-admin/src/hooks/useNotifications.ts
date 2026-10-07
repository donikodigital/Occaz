// web-admin/src/hooks/useNotifications.ts
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/services/api/notifications.api';

const KEY = ['notifications'];
const REFRESH_MS = 30_000;

/** Pastille de la cloche : revérifiée toutes les 30 s et au retour sur l'onglet. */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [...KEY, 'unread'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS / 2,
  });
}

/** Liste chargée seulement quand le panneau est ouvert. */
export function useNotificationList(limit: number, enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, 'list', limit],
    queryFn: () => notificationsApi.listMine({ page: 1, limit }),
    enabled,
    refetchInterval: enabled ? REFRESH_MS : false,
    placeholderData: keepPreviousData,
  });
}

function useInboxMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export const useMarkNotificationRead = () => useInboxMutation((id: string) => notificationsApi.markRead(id));
export const useMarkAllNotificationsRead = () => useInboxMutation(() => notificationsApi.markAllRead());
export const useRemoveNotification = () => useInboxMutation((id: string) => notificationsApi.remove(id));
export const useRemoveAllNotifications = () => useInboxMutation(() => notificationsApi.removeAll());
