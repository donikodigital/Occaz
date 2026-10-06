// mobile/src/components/screens/NotificationsInboxScreen.tsx
// [26/09/2026] v3 — Chaque notification s'ouvre en modale (texte complet,
// jamais tronqué) au lieu de se contenter d'un aperçu sur 2 lignes.
// Nouveau mode sélection (icône dans l'en-tête) : coche les notifications
// à retirer, un appui sur la corbeille les supprime après confirmation —
// jamais de suppression sans ce passage, c'est irréversible.
//
// v2 — Habillage bleu océan (partagé client / conducteur) : en-tête avec
// retour rond, sous-titre « 3 non lues » ou « Tout est à jour » et bouton
// « Tout marquer lu » en pastille ; une carte par notification avec une
// pastille de couleur selon le type (doré pour les paiements, rouge pour un
// litige, vert pour une livraison, bleu pour le reste), un point bleu quand
// elle n'est pas lue ; les notifications lues s'estompent.
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconBellRinging,
  IconChecklist,
  IconChecks,
  IconCreditCard,
  IconMessageCircle,
  IconPackage,
  IconRefresh,
  IconRoute,
  IconShieldCheck,
  IconSquare,
  IconSquareCheck,
  IconTrash,
  IconX,
} from '@tabler/icons-react-native';
import { AppText, Button, ConfirmDialog, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { colors, maxContentWidth, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import {
  useDeleteNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyNotifications,
} from '@/hooks/useNotifications';
import { useResponsive } from '@/hooks/useResponsive';
import { NOTIFICATION_TYPE_LABELS } from '@/utils/notificationLabels';
import { formatDateLong, formatTime } from '@/utils/date';
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
  CONVERSATION_MESSAGE: IconMessageCircle,
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

/** Titre à afficher — repli sur le libellé générique du type uniquement pour les lignes antérieures à la persistance de title/body (voir notifications.types.ts). */
function titleFor(notification: AppNotification): string {
  return notification.title ?? NOTIFICATION_TYPE_LABELS[notification.type];
}

// ---------------------------------------------------------------------------
// Modale de détail — texte complet, jamais tronqué
// ---------------------------------------------------------------------------

function NotificationDetailModal({
  notification,
  onClose,
  onDelete,
  deleting,
}: {
  notification: AppNotification | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const { isTablet } = useResponsive();
  if (!notification) return null;

  const tone = TILE_TONES[toneFor(notification.type)];
  const Icon = TYPE_ICON[notification.type];

  return (
    <Modal visible={Boolean(notification)} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, isTablet && styles.sheetCentered]}>
          <View style={styles.sheetHeader}>
            <View style={[styles.sheetIcon, { backgroundColor: tone.background }]}>
              <Icon size={22} color={tone.foreground} />
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            >
              <IconX size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <AppText variant="lg" weight="bold" style={styles.sheetTitle}>
            {titleFor(notification)}
          </AppText>
          <AppText variant="xs" color="textMuted" style={styles.sheetDate}>
            {formatDateLong(notification.createdAt)} · {formatTime(notification.createdAt)}
          </AppText>
          {notification.body ? (
            <AppText variant="sm" color="textSecondary" style={styles.sheetBody}>
              {notification.body}
            </AppText>
          ) : null}

          <Button
            label="Supprimer"
            variant="danger"
            loading={deleting}
            onPress={() => onDelete(notification.id)}
            style={styles.sheetDeleteButton}
          />
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Ligne de la liste
// ---------------------------------------------------------------------------

function NotificationRow({
  notification,
  selectionMode,
  selected,
  onToggleSelect,
  onOpenDetail,
}: {
  notification: AppNotification;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenDetail: () => void;
}) {
  const Icon = TYPE_ICON[notification.type];
  const isUnread = !notification.readAt;
  const tone = TILE_TONES[toneFor(notification.type)];
  const title = titleFor(notification);

  return (
    <OceanCard
      onPress={selectionMode ? onToggleSelect : onOpenDetail}
      style={[styles.row, isUnread ? styles.rowUnread : styles.rowRead, selected && styles.rowSelected]}
      accessibilityLabel={title}
    >
      {selectionMode ? (
        <View style={styles.checkbox}>
          {selected ? <IconSquareCheck size={22} color={OCEAN.base} /> : <IconSquare size={22} color={colors.textMuted} />}
        </View>
      ) : (
        <View style={[styles.rowIcon, { backgroundColor: isUnread ? tone.background : colors.surfaceMuted }]}>
          <Icon size={19} color={isUnread ? tone.foreground : colors.textMuted} />
        </View>
      )}
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
        {isUnread && !selectionMode ? <View style={styles.unreadDot} /> : null}
      </View>
    </OceanCard>
  );
}

export function NotificationsInboxScreen() {
  const { data, isLoading } = useMyNotifications();
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();
  const deleteNotifications = useDeleteNotifications();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailNotification, setDetailNotification] = useState<AppNotification | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const items = data?.data ?? [];
  const unreadCount = items.filter((n) => !n.readAt).length;

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleOpenDetail(notification: AppNotification) {
    if (!notification.readAt) markRead.mutate(notification.id);
    setDetailNotification(notification);
  }

  function handleDeleteOne(id: string) {
    deleteNotifications.mutate([id], { onSuccess: () => setDetailNotification(null) });
  }

  function handleDeleteSelected() {
    deleteNotifications.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        exitSelectionMode();
        setConfirmingDelete(false);
      },
    });
  }

  // Backend trie déjà par createdAt desc (voir NotificationsService.findMine)
  // — le regroupement suppose cet ordre pour rester contigu par section.
  const rows = useMemo<ListRow[]>(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const subtitle = selectionMode
    ? `${selectedIds.size} sélectionnée${selectedIds.size > 1 ? 's' : ''}`
    : isLoading
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
          onBack={selectionMode ? exitSelectionMode : () => router.back()}
          right={
            selectionMode ? (
              <View style={styles.headerActions}>
                <Pressable
                  onPress={() => setConfirmingDelete(true)}
                  disabled={selectedIds.size === 0 || deleteNotifications.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer la sélection"
                  style={({ pressed }) => [
                    styles.iconButton,
                    (selectedIds.size === 0 || deleteNotifications.isPending) && styles.iconButtonDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <IconTrash size={18} color={colors.danger} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.headerActions}>
                {items.length > 0 ? (
                  <Pressable
                    onPress={() => setSelectionMode(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Sélectionner des notifications"
                    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                  >
                    <IconChecklist size={18} color={OCEAN.base} />
                  </Pressable>
                ) : null}
                {unreadCount > 0 ? (
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
                ) : null}
              </View>
            )
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
            <NotificationRow
              notification={item.notification}
              selectionMode={selectionMode}
              selected={selectedIds.has(item.notification.id)}
              onToggleSelect={() => toggleSelected(item.notification.id)}
              onOpenDetail={() => handleOpenDetail(item.notification)}
            />
          )
        }
      />

      <NotificationDetailModal
        notification={detailNotification}
        onClose={() => setDetailNotification(null)}
        onDelete={handleDeleteOne}
        deleting={deleteNotifications.isPending}
      />

      <ConfirmDialog
        visible={confirmingDelete}
        title={`Supprimer ${selectedIds.size} notification${selectedIds.size > 1 ? 's' : ''} ?`}
        message="Cette action ne peut pas être annulée."
        confirmLabel="Supprimer"
        destructive
        loading={deleteNotifications.isPending}
        onConfirm={handleDeleteSelected}
        onCancel={() => setConfirmingDelete(false)}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: OCEAN.mist,
  },
  iconButtonDisabled: {
    opacity: 0.4,
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
  rowSelected: {
    borderColor: OCEAN.base,
    backgroundColor: OCEAN.mist,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 42,
    height: 42,
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
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetCentered: {
    maxWidth: maxContentWidth.form,
    width: '100%',
    alignSelf: 'center',
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  sheetTitle: {
    marginTop: spacing.md,
  },
  sheetDate: {
    marginTop: 2,
  },
  sheetBody: {
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  sheetDeleteButton: {
    marginTop: spacing.lg,
  },
});