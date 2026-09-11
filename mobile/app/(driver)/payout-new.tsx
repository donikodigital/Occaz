// mobile/app/(driver)/payout-new.tsx
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowLeft } from '@tabler/icons-react-native';
import { AppText, Button, Card, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useMyWallet } from '@/hooks/useWallet';
import { useRequestPayout } from '@/hooks/usePayouts';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';

export default function NewPayoutScreen() {
  const { data: wallet } = useMyWallet();
  const { data: profile } = useDriverProfile();
  const [amount, setAmount] = useState('');
  const [destinationRef, setDestinationRef] = useState(profile?.mobileMoneyNumber ?? '');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
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
        onSuccess: () => router.back(),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
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
          {wallet ? formatMoney(wallet.balance) : '…'}
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
});
