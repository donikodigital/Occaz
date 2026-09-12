// mobile/src/components/screens/DisputesListScreen.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconAlertTriangle, IconArrowLeft, IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText, Badge, Card, IconButton, ResponsiveList, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useMyDisputes } from '@/hooks/useDisputes';
import { DISPUTE_STATUS_LABELS, DISPUTE_STATUS_TONE } from '@/utils/disputeLabels';
import { formatDateShort } from '@/utils/date';
import type { Dispute } from '@/types/disputes.types';

export interface DisputesListScreenProps {
  basePath: '/(customer)' | '/(driver)';
}

function DisputeRow({ dispute, basePath }: { dispute: Dispute; basePath: string }) {
  const isShipment = dispute.subjectType === 'SHIPMENT';
  return (
    <Card onPress={() => router.push(`${basePath}/dispute/${dispute.id}`)} style={styles.row}>
      <View style={[styles.rowIcon, isShipment && { backgroundColor: colors.accentLight }]}>
        {isShipment ? (
          <IconPackage size={18} color={colors.accentDark} />
        ) : (
          <IconRoute size={18} color={colors.primary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {dispute.reason}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {formatDateShort(dispute.createdAt)}
        </AppText>
      </View>
      <Badge label={DISPUTE_STATUS_LABELS[dispute.status]} tone={DISPUTE_STATUS_TONE[dispute.status]} />
    </Card>
  );
}

/** Uniquement en lecture — l'ouverture d'un litige se fait depuis le détail d'une réservation ou d'un envoi, où le contexte est déjà là. */
export function DisputesListScreen({ basePath }: DisputesListScreenProps) {
  const { data: disputes, isLoading } = useMyDisputes();

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Mes litiges
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <ResponsiveList
        data={disputes ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !isLoading
            ? () => (
                <View style={styles.empty}>
                  <IconAlertTriangle size={22} color={colors.textMuted} />
                  <AppText variant="sm" color="textMuted" style={{ marginTop: spacing.xs }}>
                    Aucun litige pour le moment.
                  </AppText>
                </View>
              )
            : undefined
        }
        renderItem={({ item }) => <DisputeRow dispute={item} basePath={basePath} />}
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
