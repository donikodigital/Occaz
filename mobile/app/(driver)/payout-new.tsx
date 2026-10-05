// mobile/app/(driver)/payout-new.tsx
//
// [05/10/2026] v2 — Le retrait part tout de suite sur le compte Mobile Money (retrait automatique) ; l'écran dit ensuite ce qui s'est
// passé : effectué, en cours, demande en attente de validation (réglage de l'équipe ou montant au-dessus du plafond), ou refusé
// (le montant est alors remis dans le solde). Plus de retour silencieux sans savoir où en est son argent.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCircleCheck,
  IconClockHour4,
  IconSend,
} from '@tabler/icons-react-native';
import { AppText, Button, Card, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useMyWallet } from '@/hooks/useWallet';
import { useRequestPayout } from '@/hooks/usePayouts';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import { OceanButton } from '@/components/ocean/OceanKit';
import { OCEAN } from '@/theme/ocean';
import type { Payout } from '@/types/payouts.types';

/** Ce que le conducteur doit comprendre une fois sa demande envoyée, selon l'état du retrait renvoyé par le serveur. */
function describeOutcome(payout: Payout, amountText: string, destination: string) {
  const masked = destination.replace(/\D/g, '').length >= 4 ? `••••${destination.replace(/\D/g, '').slice(-4)}` : 'votre compte Mobile Money';
  switch (payout.status) {
    case 'PAID':
      return {
        Icon: IconCircleCheck,
        tint: colors.successDark,
        title: 'Retrait effectué',
        text: `${amountText} ont été envoyés sur votre compte Mobile Money (${masked}).`,
      };
    case 'FAILED':
    case 'CANCELLED':
      return {
        Icon: IconAlertTriangle,
        tint: colors.danger,
        title: 'Retrait refusé',
        text: `${payout.failureReason ? `${payout.failureReason} ` : ''}Le montant a été remis dans votre solde : vous pouvez réessayer avec un autre numéro.`,
      };
    case 'PROCESSING':
      return {
        Icon: IconSend,
        tint: OCEAN.base,
        title: 'Retrait en cours',
        text: `${amountText} sont en cours d'envoi vers ${masked}. Vous serez prévenu dès que ce sera arrivé.`,
      };
    default:
      return {
        Icon: IconClockHour4,
        tint: OCEAN.base,
        title: 'Demande envoyée',
        text: `Votre retrait de ${amountText} doit être validé par l'équipe avant l'envoi vers ${masked}. Vous serez prévenu dès qu'il sera traité.`,
      };
  }
}

export default function NewPayoutScreen() {
  const { data: wallet } = useMyWallet();
  const { data: profile } = useDriverProfile();
  const [amount, setAmount] = useState('');
  const [destinationRef, setDestinationRef] = useState(profile?.mobileMoneyNumber ?? '');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [result, setResult] = useState<{ payout: Payout; amountText: string; destination: string } | null>(null);
  const requestPayout = useRequestPayout();

  function handleSubmit() {
    setErrorMessage(undefined);
    const numericAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Indiquez un montant valide.');
      return;
    }
    if (wallet && numericAmount > Number(wallet.balance)) {
      setErrorMessage('Le montant dépasse votre solde disponible.');
      return;
    }
    if (!destinationRef.trim()) {
      setErrorMessage('Indiquez le numéro Mobile Money de destination.');
      return;
    }

    requestPayout.mutate(
      {
        amount: String(Math.round(numericAmount)),
        method: 'mobile_money',
        destinationRef: destinationRef.trim(),
      },
      {
        onSuccess: (payout) =>
          setResult({
            payout,
            amountText: formatMoney(Math.round(numericAmount), wallet?.currency?.isoCode),
            destination: destinationRef.trim(),
          }),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  // Résultat du retrait : dit où en est l'argent, puis retour au portefeuille.
  if (result) {
    const outcome = describeOutcome(result.payout, result.amountText, result.destination);
    return (
      <ScreenContainer maxWidth="form">
        <View style={styles.resultBody}>
          <View style={[styles.resultIcon, { backgroundColor: `${outcome.tint}1A` }]}>
            <outcome.Icon size={40} color={outcome.tint} />
          </View>
          <AppText variant="xxl" weight="bold" align="center" color={OCEAN.deep}>
            {outcome.title}
          </AppText>
          <AppText variant="base" color="textSecondary" align="center">
            {outcome.text}
          </AppText>
        </View>
        <OceanButton label="Terminé" onPress={() => router.back()} style={styles.submit} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Retirer des fonds
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <Card style={styles.balanceCard}>
        <AppText variant="sm" color="textSecondary">
          Solde disponible
        </AppText>
        <AppText variant="xl" weight="semibold">
          {wallet ? formatMoney(wallet.balance, wallet.currency?.isoCode) : '…'}
        </AppText>
      </Card>

      <View style={styles.fields}>
        <TextField
          label="Montant à retirer"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Ex : 100000"
        />
        <TextField
          label="Numéro Mobile Money"
          value={destinationRef}
          onChangeText={setDestinationRef}
          keyboardType="phone-pad"
          placeholder="+224620000000"
        />
      </View>

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button
        label="Confirmer le retrait"
        onPress={handleSubmit}
        loading={requestPayout.isPending}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  balanceCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  fields: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
  resultBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  resultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
