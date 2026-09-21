// mobile/src/components/screens/NotificationsInboxScreen.tsx
// [21/09/2026] v+ — icônes des types SHIPMENT_REQUEST et SHIPMENT_EXTENSION.
//
// v2 — Habillage bleu océan (partagé client / chauffeur) : en-tête avec
// retour rond, sous-titre « 3 non lues » ou « Tout est à jour » et bouton
// « Tout marquer lu » en pastille ; une carte par notification avec une
// pastille de couleur selon le type (doré pour les paiements, rouge pour un
// litige, vert pour une livraison, bleu pour le reste), un point bleu quand
// elle n'est pas lue ; les notifications lues s'estompent. Logique inchangée.
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconBellRinging,
  IconChecks,
  IconCreditCard,
  IconMessageCircle,
  IconPackage,
  IconRefresh,
  IconRoute,
  IconShieldCheck,
} from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
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
  SHIPMENT_REQUEST: IconPackage,
  SHIPMENT_EXTENSION: IconRefresh,
};

type Tone = 'ocean' | 'gold' | 'danger' | 'success';

/** Un type inconnu retombe sur le bleu : une nouvelle notification ne casse jamais l'écran. */
function toneFor(type: NotificationType): Tone {
  switch (type) {
    case 'PAYMENT':
    case 'DRIVER_PAYMENT':
    case 'REFUND':
      return 'gold';
    case 'DISPUTE':
      return 'danger';
    case 'DELIVERY':
      return 'success';
    default:
      return 'ocean';
  }
}

const TILE_TONES: Record<Tone, { background: string; foreground: string }> = {
  ocean: { background: OCEAN.mist, foreground: OCEAN.base },
  gold: { background: OCEAN.goldSoft, foreground: OCEAN.goldInk },
  danger: { background: '#FDE8E8', foreground: colors.danger },
  success: { background: colors.successLight, foreground: colors.successDark },
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
  const tone = TILE_TONES[toneFor(notification.type)];
  // Repli sur le libellé générique du type uniquement pour les lignes
  // antérieures à la persistance de title/body (voir notifications.types.ts).
  const title = notification.title ?? NOTIFICATION_TYPE_LABELS[notification.type];

  return (
    <OceanCard
      onPress={() => {
        if (isUnread) markRead.mutate(notification.id);
      }}
      style={[styles.row, isUnread ? styles.rowUnread : styles.rowRead]}
      accessibilityLabel={title}
    >
      <View style={[styles.rowIcon, { backgroundColor: isUnread ? tone.background : colors.surfaceMuted }]}>
        <Icon size={19} color={isUnread ? tone.foreground : colors.textMuted} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight={isUnread ? 'bold' : 'medium'} numberOfLines={1}>
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
    </OceanCard>
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

  const subtitle = isLoading
    ? undefined
    : unreadCount > 0
      ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
      : 'Tout est à jour';

  return (
    <ScreenContainer padded={false} maxWidth="detail">
      <View style={styles.header}>
        <OceanScreenHeader
          title="Notifications"
          subtitle={subtitle}
          onBack={() => router.back()}
          right={
            unreadCount > 0 ? (
              <Pressable
                onPress={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                accessibilityRole="button"
                accessibilityLabel="Tout marquer comme lu"
                style={({ pressed }) => [styles.markAll, pressed && styles.pressed, markAllRead.isPending && styles.markAllDisabled]}
              >
                <IconChecks size={15} color={OCEAN.base} />
                <AppText variant="xs" weight="bold" color={OCEAN.base}>
                  Tout lire
                </AppText>
              </Pressable>
            ) : undefined
          }
        />
      </View>

      <ResponsiveList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs + 2 }} />}
        ListEmptyComponent={
          !isLoading ? (
            <OceanEmpty
              icon={<IconBellRinging size={28} color={OCEAN.base} />}
              title="Rien de nouveau"
              text="Vos notifications — paiements, trajets, envois, messages du support — apparaîtront ici."
            />
          ) : undefined
        }
        renderItem={({ item }: { item: ListRow }) =>
          item.kind === 'header' ? (
            <AppText variant="xs" weight="bold" color={OCEAN.base} style={styles.sectionLabel}>
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
  pressed: {
    opacity: 0.75,
  },
  header: {
    paddingHorizontal: spacing.lg,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 40,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: OCEAN.mist,
  },
  markAllDisabled: {
    opacity: 0.5,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 4,
  },
  rowUnread: {
    borderColor: OCEAN.sky,
  },
  rowRead: {
    opacity: 0.85,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowBody: {
    marginTop: 1,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: OCEAN.bright,
  },
});