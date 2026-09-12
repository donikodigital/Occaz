// mobile/src/components/screens/NotificationsInboxScreen.tsx
import React from 'react';
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
import { AppText, Card, IconButton, ResponsiveList, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useMyNotifications } from '@/hooks/useNotifications';
import { NOTIFICATION_TYPE_LABELS } from '@/utils/notificationLabels';
import { formatDateShort, formatTime } from '@/utils/date';
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

function NotificationRow({ notification }: { notification: AppNotification }) {
  const markRead = useMarkNotificationRead();
  const Icon = TYPE_ICON[notification.type];
  const isUnread = !notification.readAt;

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
        <AppText variant="sm" weight={isUnread ? 'semibold' : 'regular'}>
          {NOTIFICATION_TYPE_LABELS[notification.type]}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {formatDateShort(notification.createdAt)} · {formatTime(notification.createdAt)}
        </AppText>
      </View>
      {isUnread ? <View style={styles.unreadDot} /> : null}
    </Card>
  );
}

export function NotificationsInboxScreen() {
  const { data, isLoading } = useMyNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  const hasUnread = (data?.data ?? []).some((n) => !n.readAt);

  return (
    <ScreenContainer padded={false} maxWidth="detail">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Notifications
        </AppText>
        {hasUnread ? (
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
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
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
        renderItem={({ item }) => <NotificationRow notification={item} />}
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
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconUnread: {
    backgroundColor: colors.primaryLight,
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
