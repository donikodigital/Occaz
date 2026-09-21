// mobile/src/components/screens/ConversationsListScreen.tsx
//
// v2 — Habillage bleu océan (partagé client / chauffeur) : titre avec
// sous-titre, cartes ombrées avec une pastille de couleur par type
// (bleu pour un trajet, doré pour un envoi), et un état vide qui explique
// quand une conversation apparaît. Logique inchangée.
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronRight, IconMessageCircle, IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
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
    <OceanCard
      onPress={() => router.push(`${basePath}/conversation/${conversation.id}`)}
      style={styles.row}
      accessibilityLabel={isShipment ? 'Conversation sur un envoi' : 'Conversation sur un trajet'}
    >
      <View style={[styles.rowIcon, isShipment && styles.rowIconShipment]}>
        {isShipment ? <IconPackage size={20} color={OCEAN.goldInk} /> : <IconRoute size={20} color={OCEAN.base} />}
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold">
          {isShipment ? 'Envoi' : 'Trajet'}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {formatTime(conversation.createdAt)}
        </AppText>
      </View>
      <IconChevronRight size={16} color={colors.textMuted} />
    </OceanCard>
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

  const header = (
    <View style={styles.header}>
      <AppText variant="xxl" weight="bold" color={OCEAN.deep}>
        Messages
      </AppText>
      <AppText variant="sm" color="textSecondary">
        Vos échanges liés aux trajets et aux envois.
      </AppText>
    </View>
  );

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <ResponsiveList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs + 2 }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !isLoading ? (
            <OceanEmpty
              icon={<IconMessageCircle size={28} color={OCEAN.base} />}
              title="Aucune conversation"
              text="Une conversation apparaît ici dès qu'un trajet ou un envoi est réservé."
            />
          ) : undefined
        }
        renderItem={({ item }: { item: ListRow }) =>
          item.kind === 'header' ? (
            <AppText variant="xs" weight="bold" color={OCEAN.base} style={styles.sectionLabel}>
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
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
    gap: 2,
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
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconShipment: {
    backgroundColor: OCEAN.goldSoft,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});