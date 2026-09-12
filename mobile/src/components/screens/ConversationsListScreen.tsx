// mobile/src/components/screens/ConversationsListScreen.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconMessageCircle, IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText, Card, ResponsiveList, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useMyConversations } from '@/hooks/useConversations';
import { formatDateShort, formatTime } from '@/utils/date';
import type { ConversationSummary } from '@/types/conversations.types';

export interface ConversationsListScreenProps {
  /** Racine de navigation du groupe appelant — (customer) et (driver) sont deux Stacks Expo Router isolés. */
  basePath: '/(customer)' | '/(driver)';
}

function ConversationRow({ conversation, basePath }: { conversation: ConversationSummary; basePath: string }) {
  const isShipment = Boolean(conversation.shipmentId);
  return (
    <Card onPress={() => router.push(`${basePath}/conversation/${conversation.id}`)} style={styles.row}>
      <View style={[styles.rowIcon, isShipment && { backgroundColor: colors.accentLight }]}>
        {isShipment ? (
          <IconPackage size={18} color={colors.accentDark} />
        ) : (
          <IconRoute size={18} color={colors.primary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="sm" weight="semibold">
          {isShipment ? 'Envoi' : 'Trajet'}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {formatDateShort(conversation.createdAt)} · {formatTime(conversation.createdAt)}
        </AppText>
      </View>
    </Card>
  );
}

/**
 * Le backend (GET /conversations/mine) ne renvoie ni le nom du
 * correspondant ni le nombre de messages non lus — seulement les
 * références booking/shipment. Cette liste reste donc volontairement
 * sobre (type de conversation + date) ; le contexte riche (qui écrit
 * quoi) apparaît une fois dans le fil.
 */
export function ConversationsListScreen({ basePath }: ConversationsListScreenProps) {
  const { data, isLoading } = useMyConversations();

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <View style={styles.header}>
        <AppText variant="xxl" weight="semibold">
          Messages
        </AppText>
      </View>

      <ResponsiveList
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !isLoading
            ? () => (
                <View style={styles.empty}>
                  <IconMessageCircle size={22} color={colors.textMuted} />
                  <AppText variant="sm" color="textMuted" style={{ marginTop: spacing.xs }}>
                    Aucune conversation pour le moment.
                  </AppText>
                </View>
              )
            : undefined
        }
        renderItem={({ item }) => <ConversationRow conversation={item} basePath={basePath} />}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
});
