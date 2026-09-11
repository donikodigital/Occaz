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
  CANCELLATION_FEE: 'Frais d\'annulation',
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

function TransactionRow({ tx }: { tx: WalletTransaction }) {
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
        {formatMoney(tx.amount)}
      </AppText>
    </Card>
  );
}

export default function DriverWalletScreen() {
  const { data: wallet } = useMyWallet();
  const { data: transactionsPage, isLoading } = useMyWalletTransactions();
  const { data: payoutsPage } = useMyPayouts();

  const recentPayouts = payoutsPage?.data.slice(0, 3) ?? [];

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <View style={styles.header}>
        <AppText variant="xxl" weight="semibold">
          Portefeuille
        </AppText>
      </View>

      <View style={styles.balanceSection}>
        <Card style={styles.balanceCard}>
          <View style={styles.balanceIcon}>
            <IconWallet size={22} color={colors.successDark} />
          </View>
          <AppText variant="sm" color="textSecondary">
            Solde disponible
          </AppText>
          <AppText variant="display" weight="bold">
            {wallet ? formatMoney(wallet.balance) : '…'}
          </AppText>
          {wallet && Number(wallet.pendingBalance) > 0 ? (
            <AppText variant="xs" color="textMuted" style={styles.pendingNote}>
              + {formatMoney(wallet.pendingBalance)} en attente (prestations en cours)
            </AppText>
          ) : null}
          <Button
            label="Retirer"
            onPress={() => router.push('/(driver)/payout-new')}
            fullWidth={false}
            style={styles.withdrawButton}
          />
        </Card>

        {recentPayouts.length > 0 ? (
          <View style={styles.payoutsSection}>
            <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
              Retraits récents
            </AppText>
            <View style={styles.payoutsList}>
              {recentPayouts.map((payout) => (
                <Card key={payout.id} style={styles.payoutRow}>
                  <View style={styles.txIcon}>
                    <IconReceipt size={16} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="sm" weight="medium">
                      {formatMoney(payout.amount)}
                    </AppText>
                    <AppText variant="xs" color="textSecondary">
                      {formatDateShort(payout.requestedAt)}
                    </AppText>
                  </View>
                  <Badge label={PAYOUT_STATUS_LABELS[payout.status]} tone={PAYOUT_STATUS_TONE[payout.status]} />
                </Card>
              ))}
            </View>
          </View>
        ) : null}

        <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
          Historique
        </AppText>
      </View>

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
        renderItem={({ item }) => <TransactionRow tx={item} />}
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
  balanceSection: {
    paddingHorizontal: spacing.lg,
  },
  balanceCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  balanceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  pendingNote: {
    marginTop: spacing.xxs,
  },
  withdrawButton: {
    marginTop: spacing.md,
    minWidth: 160,
  },
  payoutsSection: {
    marginBottom: spacing.lg,
  },
  payoutsList: {
    gap: spacing.xs,
  },
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  txIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  empty: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
});
