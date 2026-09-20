// mobile/src/components/screens/NotificationsInboxScreen.tsx
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBellRinging,
  IconCreditCard,
  IconMessageCircle,
  IconPackage,
  IconRefresh,
  IconRoute,
  IconShieldCheck,
} from '@tabler/icons-react-native';
import { AppText, Badge, Card, IconButton, ResponsiveList, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useMyNotifications } from '@/hooks/useNotifications';
import { NOTIFICATION_TYPE_LABELS } from '@/utils/notificationLabels';
import { formatTime } from '@/utils/date';
import type { AppNotification, NotificationType } from '@/types/notifications.types';

const TYPE_ICON: Record<NotificationType, React.ComponentType<{ size?: number; color?: string }>> = {
  BOOKING: IconRoute,
  PAYMENT: IconCreditCard,
  DRIVER_ACCEPTED: IconRoute,
  DRIVER_REJECTED: IconRoute,
  DEPARTURE_IMMINENT: IconRoute,
  ARRIVAL: IconRoute,
  OTP: IconShieldCheck,
  DELIVERY: IconPackage,
  DRIVER_PAYMENT: IconCreditCard,
  DISPUTE: IconAlertTriangle,
  REFUND: IconCreditCard,
  STATUS_CHANGE: IconRefresh,
  SUPPORT_MESSAGE: IconMessageCircle,
};

type ListRow = { kind: 'header'; key: string; label: string } | { kind: 'item'; key: string; notification: AppNotification };

function sectionLabelFor(dateIso: string, now: Date): string {
  const date = new Date(dateIso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfItemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfItemDay.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return 'Cette semaine';
  return 'Plus tôt';
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const markRead = useMarkNotificationRead();
  const Icon = TYPE_ICON[notification.type];
  const isUnread = !notification.readAt;
  // Repli sur le libellé générique du type uniquement pour les lignes
  // antérieures à la persistance de title/body (voir notifications.types.ts).
  const title = notification.title ?? NOTIFICATION_TYPE_LABELS[notification.type];

  return (
    <Card
      onPress={() => {
        if (isUnread) markRead.mutate(notification.id);
      }}
      style={styles.row}
    >
      <View style={[styles.rowIcon, isUnread && styles.rowIconUnread]}>
        <Icon size={18} color={isUnread ? colors.primary : colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="sm" weight={isUnread ? 'semibold' : 'regular'} numberOfLines={1}>
          {title}
        </AppText>
        {notification.body ? (
          <AppText variant="xs" color="textSecondary" numberOfLines={2} style={styles.rowBody}>
            {notification.body}
          </AppText>
        ) : null}
      </View>
      <View style={styles.rowMeta}>
        <AppText variant="xs" color="textMuted">
          {formatTime(notification.createdAt)}
        </AppText>
        {isUnread ? <View style={styles.unreadDot} /> : null}
      </View>
    </Card>
  );
}

export function NotificationsInboxScreen() {
  const { data, isLoading } = useMyNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = (data?.data ?? []).filter((n) => !n.readAt).length;

  // Backend trie déjà par createdAt desc (voir NotificationsService.findMine)
  // — le regroupement suppose cet ordre pour rester contigu par section.
  const rows = useMemo<ListRow[]>(() => {
    const items = data?.data ?? [];
    const now = new Date();
    const out: ListRow[] = [];
    let lastLabel: string | null = null;
    for (const notification of items) {
      const label = sectionLabelFor(notification.createdAt, now);
      if (label !== lastLabel) {
        out.push({ kind: 'header', key: `header-${label}`, label });
        lastLabel = label;
      }
      out.push({ kind: 'item', key: notification.id, notification });
    }
    return out;
  }, [data]);

  return (
    <ScreenContainer padded={false} maxWidth="detail">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <View style={styles.headerTitleGroup}>
          <AppText variant="lg" weight="semibold">
            Notifications
          </AppText>
          {unreadCount > 0 ? <Badge label={String(unreadCount)} tone="primary" /> : null}
        </View>
        {unreadCount > 0 ? (
          <AppText
            variant="sm"
            weight="semibold"
            color="primary"
            onPress={() => markAllRead.mutate()}
            suppressHighlighting
          >
            Tout marquer lu
          </AppText>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      <ResponsiveList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        ListEmptyComponent={
          !isLoading
            ? () => (
                <View style={styles.empty}>
                  <IconBellRinging size={22} color={colors.textMuted} />
                  <AppText variant="sm" color="textMuted" style={{ marginTop: spacing.xs }}>
                    Aucune notification pour le moment.
                  </AppText>
                </View>
              )
            : undefined
        }
        renderItem={({ item }: { item: ListRow }) =>
          item.kind === 'header' ? (
            <AppText variant="xs" weight="semibold" color="textMuted" style={styles.sectionLabel}>
              {item.label}
            </AppText>
          ) : (
            <NotificationRow notification={item.notification} />
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  headerTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconUnread: {
    backgroundColor: colors.primaryLight,
  },
  rowBody: {
    marginTop: 2,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: spacing.xxs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
});