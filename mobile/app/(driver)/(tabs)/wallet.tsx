// mobile/app/(driver)/(tabs)/wallet.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconArrowDownCircle,
  IconArrowUpCircle,
  IconReceipt,
  IconWallet,
} from '@tabler/icons-react-native';
import { AppText, Badge, Button, Card, ResponsiveList, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useMyWallet, useMyWalletTransactions } from '@/hooks/useWallet';
import { useMyPayouts } from '@/hooks/usePayouts';
import { formatMoney } from '@/utils/money';
import { formatDateShort } from '@/utils/date';
import type { WalletTransaction, WalletTransactionType } from '@/types/wallets.types';
import type { PayoutStatus } from '@/types/payouts.types';

const TX_LABELS: Record<WalletTransactionType, string> = {
  BOOKING_REVENUE: 'Trajet',
  SHIPMENT_REVENUE: 'Envoi',
  COMMISSION: 'Commission',
  REFUND: 'Remboursement',
  PAYOUT: 'Retrait',
  ADJUSTMENT: 'Ajustement',
  CANCELLATION_FEE: "Frais d'annulation",
};

const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  REQUESTED: 'Demandé',
  PROCESSING: 'En cours',
  PAID: 'Payé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
};

const PAYOUT_STATUS_TONE: Record<PayoutStatus, 'primary' | 'success' | 'danger' | 'neutral'> = {
  REQUESTED: 'neutral',
  PROCESSING: 'primary',
  PAID: 'success',
  FAILED: 'danger',
  CANCELLED: 'danger',
};

const OCEAN_BG = '#071019';
const OCEAN_CARD = 'rgba(255,255,255,0.06)';
const OCEAN_BORDER = 'rgba(255,255,255,0.12)';

function TransactionRow({ tx, currencyCode }: { tx: WalletTransaction; currencyCode: string }) {
  const isCredit = Number(tx.amount) >= 0;
  return (
    <Card style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: isCredit ? colors.successLight : colors.dangerLight }]}>
        {isCredit ? (
          <IconArrowDownCircle size={18} color={colors.successDark} />
        ) : (
          <IconArrowUpCircle size={18} color={colors.dangerDark} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="sm" weight="semibold">
          {TX_LABELS[tx.type]}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {formatDateShort(tx.createdAt)}
        </AppText>
      </View>
      <AppText variant="sm" weight="semibold" color={isCredit ? 'success' : 'danger'}>
        {isCredit ? '+' : ''}
        {formatMoney(tx.amount, currencyCode)}
      </AppText>
    </Card>
  );
}

export default function DriverWalletScreen() {
  const { data: wallet } = useMyWallet();
  const { data: transactionsPage, isLoading } = useMyWalletTransactions();
  const { data: payoutsPage } = useMyPayouts();

  const recentPayouts = payoutsPage?.data.slice(0, 3) ?? [];
  const hasPending = wallet && Number(wallet.pendingBalance) > 0;
  const currencyCode = wallet?.currency.isoCode ?? 'GNF';

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <View style={styles.hero}>
        <AppText variant="sm" weight="medium" color={colors.textOnDark} style={styles.heroLabel}>
          Solde disponible
        </AppText>
        <AppText variant="display" weight="bold" color={colors.textOnDark}>
          {wallet ? formatMoney(wallet.balance, currencyCode) : '…'}
        </AppText>

        {hasPending ? (
          <View style={styles.pendingPill}>
            <IconWallet size={13} color={colors.textOnDark} />
            <AppText variant="xs" color="rgba(255,255,255,0.9)">
              + {formatMoney(wallet!.pendingBalance, currencyCode)} en attente
            </AppText>
          </View>
        ) : null}

        <Button
          label="Retirer"
          onPress={() => router.push('/(driver)/payout-new')}
          fullWidth={false}
          style={styles.withdrawButton}
        />

        {recentPayouts.length > 0 ? (
          <View style={styles.heroPayouts}>
            <AppText variant="xs" weight="semibold" color="rgba(255,255,255,0.6)" style={styles.heroPayoutsTitle}>
              RETRAITS RÉCENTS
            </AppText>
            {recentPayouts.map((payout) => (
              <View key={payout.id} style={styles.heroPayoutRow}>
                <View style={styles.heroPayoutIcon}>
                  <IconReceipt size={15} color={colors.textOnDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="sm" weight="medium" color={colors.textOnDark}>
                    {formatMoney(payout.amount, currencyCode)}
                  </AppText>
                  <AppText variant="xs" color="rgba(255,255,255,0.55)">
                    {formatDateShort(payout.requestedAt)}
                  </AppText>
                </View>
                <Badge label={PAYOUT_STATUS_LABELS[payout.status]} tone={PAYOUT_STATUS_TONE[payout.status]} />
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
          Historique
        </AppText>
        <ResponsiveList
          data={transactionsPage?.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          ListEmptyComponent={
            !isLoading
              ? () => (
                  <View style={styles.empty}>
                    <IconReceipt size={20} color={colors.textMuted} />
                    <AppText variant="sm" color="textMuted" style={{ marginTop: spacing.xs }}>
                      Aucune transaction pour le moment.
                    </AppText>
                  </View>
                )
              : undefined
          }
          renderItem={({ item }) => <TransactionRow tx={item} currencyCode={currencyCode} />}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: OCEAN_BG,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  heroLabel: { opacity: 0.7, marginBottom: 2 },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: OCEAN_CARD,
    borderWidth: 1,
    borderColor: OCEAN_BORDER,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.sm,
  },
  withdrawButton: { marginTop: spacing.lg, minWidth: 160 },
  heroPayouts: { marginTop: spacing.xl, gap: spacing.xs },
  heroPayoutsTitle: { letterSpacing: 0.6, marginBottom: spacing.xxs },
  heroPayoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: OCEAN_CARD,
    borderWidth: 1,
    borderColor: OCEAN_BORDER,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  heroPayoutIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm + 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sectionTitle: { marginBottom: spacing.sm },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  txIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingBottom: spacing.xl },
  empty: { alignItems: 'center', marginTop: spacing.xl },
});