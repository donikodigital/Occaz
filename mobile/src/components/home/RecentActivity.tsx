// mobile/src/components/home/RecentActivity.tsx
//
// [08/10/2026] v2 — « Activité récente » n'est plus réservée aux notifications : c'est une chronologie mêlée (trajets créés ou réservés,
// envois, recherches de trajet, notifications), triée du plus récent au plus ancien ; chaque ligne ouvre SON élément (le trajet, l'envoi,
// la recherche refaite…). Le pied de carte mène aux notifications.
// v1 — Carte « Activité récente » de l'accueil : les dernières notifications, une ligne chacune — pastille d'icône, titre, texte,
// ancienneté — avec un point doré tant qu'elle n'est pas lue.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  IconAlertTriangle,
  IconBell,
  IconChevronRight,
  IconCreditCard,
  IconMessageCircle,
  IconPackage,
  IconRefresh,
  IconRoute,
  IconShieldCheck,
} from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { timeAgo } from '@/utils/shipmentDisplay';
import type { AppNotification, NotificationType } from '@/types/notifications.types';

type IconType = React.ComponentType<{ size?: number; color?: string }>;

const TYPE_ICON: Record<NotificationType, IconType> = {
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
  CONVERSATION_MESSAGE: IconMessageCircle,
};

const GOLD_TYPES = new Set<NotificationType>(['PAYMENT', 'DRIVER_PAYMENT', 'REFUND', 'SHIPMENT_REQUEST', 'DELIVERY']);

export type ActivityTone = 'ocean' | 'gold' | 'danger';

/** Une ligne de la chronologie, quelle que soit sa source (notification, trajet, envoi, recherche). */
export interface ActivityItem {
  key: string;
  icon: IconType;
  tone: ActivityTone;
  title: string;
  text?: string | null;
  /** Date ISO : sert au tri et à « Il y a 3 j ». */
  at: string;
  unread?: boolean;
  onPress: () => void;
}

/** Une notification devient une ligne de la chronologie. */
export function notificationToActivity(notification: AppNotification, onPress: () => void): ActivityItem {
  const tone: ActivityTone = notification.type === 'DISPUTE' ? 'danger' : GOLD_TYPES.has(notification.type) ? 'gold' : 'ocean';
  return {
    key: `n-${notification.id}`,
    icon: TYPE_ICON[notification.type] ?? IconBell,
    tone,
    title: notification.title ?? notification.body ?? 'Notification',
    text: notification.title ? notification.body : null,
    at: notification.createdAt,
    unread: !notification.readAt,
    onPress,
  };
}

/** Du plus récent au plus ancien, `limit` lignes au plus. */
export function sortActivity(items: ActivityItem[], limit: number): ActivityItem[] {
  return [...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, limit);
}

const TONES: Record<ActivityTone, { background: string; foreground: string }> = {
  ocean: { background: OCEAN.mist, foreground: OCEAN.base },
  gold: { background: OCEAN.goldSoft, foreground: OCEAN.goldInk },
  danger: { background: '#FDE8E8', foreground: colors.danger },
};

export function RecentActivity({
  items,
  isLoading,
  onPressAll,
  allLabel = 'Voir les notifications',
}: {
  items: ActivityItem[];
  isLoading?: boolean;
  onPressAll: () => void;
  allLabel?: string;
}) {
  return (
    <View style={styles.card}>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.rowIcon}>
            <IconBell size={19} color={OCEAN.base} />
          </View>
          <AppText variant="sm" color="textSecondary" style={styles.rowText}>
            {isLoading ? 'Chargement…' : 'Rien pour l’instant. Vos trajets, envois, recherches et messages apparaîtront ici.'}
          </AppText>
        </View>
      ) : (
        items.map((item, index) => {
          const Icon = item.icon;
          const tone = TONES[item.tone];
          return (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              style={({ pressed }) => [styles.row, index > 0 && styles.rowBorder, pressed && styles.pressed]}
            >
              <View style={[styles.rowIcon, { backgroundColor: tone.background }]}>
                <Icon size={19} color={tone.foreground} />
              </View>
              <View style={styles.rowText}>
                <AppText variant="sm" weight={item.unread ? 'bold' : 'semibold'} color={OCEAN.deep} numberOfLines={1}>
                  {item.title}
                </AppText>
                {item.text ? (
                  <AppText variant="xs" color="textSecondary" numberOfLines={2}>
                    {item.text}
                  </AppText>
                ) : null}
                <AppText variant="xs" color="textMuted">
                  {timeAgo(item.at)}
                </AppText>
              </View>
              {item.unread ? <View style={styles.unreadDot} /> : <IconChevronRight size={16} color={colors.textMuted} />}
            </Pressable>
          );
        })
      )}

      <Pressable onPress={onPressAll} accessibilityRole="link" style={({ pressed }) => [styles.all, pressed && styles.pressed]}>
        <AppText variant="xs" weight="bold" color={OCEAN.base}>
          {allLabel}
        </AppText>
        <IconChevronRight size={14} color={OCEAN.base} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: OCEAN.line,
    paddingHorizontal: spacing.md,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: OCEAN.line,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: OCEAN.gold,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  all: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: OCEAN.line,
  },
});