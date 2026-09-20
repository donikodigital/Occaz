// mobile/src/components/screens/ConversationsListScreen.tsx
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronRight, IconMessageCircle, IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText, Card, ResponsiveList, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useMyConversations } from '@/hooks/useConversations';
import { formatTime } from '@/utils/date';
import type { ConversationSummary } from '@/types/conversations.types';

export interface ConversationsListScreenProps {
  /** Racine de navigation du groupe appelant — (customer) et (driver) sont deux Stacks Expo Router isolés. */
  basePath: '/(customer)' | '/(driver)';
}

type ListRow =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'item'; key: string; conversation: ConversationSummary };

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

function ConversationRow({ conversation, basePath }: { conversation: ConversationSummary; basePath: string }) {
  const isShipment = Boolean(conversation.shipmentId);
  return (
    <Card onPress={() => router.push(`${basePath}/conversation/${conversation.id}`)} style={styles.row}>
      <View style={[styles.rowIcon, isShipment && { backgroundColor: colors.accentLight }]}>
        {isShipment ? (
          <IconPackage size={19} color={colors.accentDark} />
        ) : (
          <IconRoute size={19} color={colors.primary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="sm" weight="semibold">
          {isShipment ? 'Envoi' : 'Trajet'}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {formatTime(conversation.createdAt)}
        </AppText>
      </View>
      <IconChevronRight size={16} color={colors.textMuted} />
    </Card>
  );
}

/**
 * Le backend (GET /conversations/mine) ne renvoie ni le nom du
 * correspondant ni un aperçu du dernier message ni un compteur de non
 * lus — seulement les références booking/shipment et la date de
 * création. Cette liste reste donc volontairement sobre (type +
 * horaire, regroupés par jour comme NotificationsInboxScreen) ; le
 * contexte riche (qui écrit quoi) apparaît une fois dans le fil.
 */
export function ConversationsListScreen({ basePath }: ConversationsListScreenProps) {
  const { data, isLoading } = useMyConversations();

  const rows = useMemo<ListRow[]>(() => {
    const items = data?.data ?? [];
    const now = new Date();
    const out: ListRow[] = [];
    let lastLabel: string | null = null;
    for (const conversation of items) {
      const label = sectionLabelFor(conversation.createdAt, now);
      if (label !== lastLabel) {
        out.push({ kind: 'header', key: `header-${label}`, label });
        lastLabel = label;
      }
      out.push({ kind: 'item', key: conversation.id, conversation });
    }
    return out;
  }, [data]);

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <View style={styles.header}>
        <AppText variant="xxl" weight="semibold">
          Messages
        </AppText>
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
                  <IconMessageCircle size={22} color={colors.textMuted} />
                  <AppText variant="sm" color="textMuted" style={{ marginTop: spacing.xs }}>
                    Aucune conversation pour le moment.
                  </AppText>
                  <AppText variant="xs" color="textMuted" align="center" style={styles.emptyHint}>
                    Une conversation apparaît ici dès qu'un trajet ou un envoi est réservé.
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
            <ConversationRow conversation={item.conversation} basePath={basePath} />
          )
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
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
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  emptyHint: {
    marginTop: spacing.xxs,
  },
});