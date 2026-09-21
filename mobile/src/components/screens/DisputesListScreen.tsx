// mobile/src/components/screens/DisputesListScreen.tsx
//
// v2 — Habillage bleu océan (partagé client / chauffeur) : en-tête avec
// retour rond et sous-titre, une carte par litige (pastille bleue pour un
// trajet, dorée pour un envoi, motif, date, statut) et un état vide qui
// rassure au lieu d'afficher un simple « Aucun litige ».
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronRight, IconPackage, IconRoute, IconShieldCheck } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty, OceanPill, OceanScreenHeader, type OceanPillTone } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useMyDisputes } from '@/hooks/useDisputes';
import { DISPUTE_STATUS_LABELS, DISPUTE_STATUS_TONE } from '@/utils/disputeLabels';
import { formatDateShort } from '@/utils/date';
import type { Dispute } from '@/types/disputes.types';

export interface DisputesListScreenProps {
  basePath: '/(customer)' | '/(driver)';
}

/** Les tons du Badge historique (primary, success, danger, neutral) vers ceux des pastilles océan. */
function pillToneFor(tone: string): OceanPillTone {
  if (tone === 'success') return 'success';
  if (tone === 'danger') return 'danger';
  if (tone === 'neutral') return 'neutral';
  return 'ocean';
}

function DisputeRow({ dispute, basePath }: { dispute: Dispute; basePath: string }) {
  const isShipment = dispute.subjectType === 'SHIPMENT';
  return (
    <OceanCard onPress={() => router.push(`${basePath}/dispute/${dispute.id}`)} style={styles.row} accessibilityLabel={dispute.reason}>
      <View style={[styles.rowIcon, isShipment && styles.rowIconShipment]}>
        {isShipment ? <IconPackage size={19} color={OCEAN.goldInk} /> : <IconRoute size={19} color={OCEAN.base} />}
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {dispute.reason}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {formatDateShort(dispute.createdAt)}
        </AppText>
      </View>
      <View style={styles.rowEnd}>
        <OceanPill label={DISPUTE_STATUS_LABELS[dispute.status]} tone={pillToneFor(DISPUTE_STATUS_TONE[dispute.status])} />
        <IconChevronRight size={16} color={colors.textMuted} />
      </View>
    </OceanCard>
  );
}

/** Uniquement en lecture — l'ouverture d'un litige se fait depuis le détail d'une réservation ou d'un envoi, où le contexte est déjà là. */
export function DisputesListScreen({ basePath }: DisputesListScreenProps) {
  const { data: disputes, isLoading } = useMyDisputes();

  const header = (
    <OceanScreenHeader title="Mes litiges" subtitle="Le suivi de vos signalements" onBack={() => router.back()} />
  );

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <ResponsiveList
        data={disputes ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !isLoading ? (
            <OceanEmpty
              icon={<IconShieldCheck size={28} color={OCEAN.base} />}
              title="Aucun litige"
              text="Tout se passe bien. Si un problème survient, signalez-le depuis le détail d'une réservation ou d'un envoi."
            />
          ) : undefined
        }
        renderItem={({ item }) => <DisputeRow dispute={item} basePath={basePath} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
  },
  rowIcon: {
    width: 42,
    height: 42,
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
  rowEnd: {
    alignItems: 'flex-end',
    gap: 6,
  },
});