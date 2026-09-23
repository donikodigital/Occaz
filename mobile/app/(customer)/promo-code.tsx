// mobile/app/(customer)/promo-code.tsx
//
// v1 — Simulateur de code promo : le code est vérifié et l'économie
// calculée pour un montant donné, mais n'est pas encore appliqué
// automatiquement à un paiement réel (le checkout n'est pas encore
// branché sur les codes promo — voir PromoCodesService, backend).

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconDiscount2 } from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanCard, OceanChip, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useValidatePromoCode } from '@/hooks/usePromotions';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import type { ServiceType } from '@/types/promotions.types';

export default function PromoCodeScreen() {
  const [code, setCode] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('TRIP');
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const validatePromoCode = useValidatePromoCode();

  function handleCheck() {
    setErrorMessage(undefined);
    const numericAmount = amount.replace(/\D/g, '');
    if (!code.trim() || !numericAmount) {
      setErrorMessage('Renseignez le code et un montant estimé.');
      return;
    }
    validatePromoCode.mutate(
      { code: code.trim().toUpperCase(), serviceType, amount: numericAmount },
      { onError: (error) => setErrorMessage(error instanceof ApiError ? error.message : 'Code invalide.') },
    );
  }

  const result = validatePromoCode.data;

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Saisir un code promo" onBack={() => router.back()} />

      <View style={styles.hero}>
        <IconDiscount2 size={22} color={OCEAN.base} />
        <AppText variant="sm" color="textSecondary" style={{ flex: 1 }}>
          Entrez votre code, le type de prestation et le montant estimé pour voir l'économie réalisée.
        </AppText>
      </View>

      <TextField
        label="Code promo"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder="BIENVENUE10"
        autoCapitalize="characters"
      />

      <View style={styles.chips}>
        <OceanChip label="Trajet" active={serviceType === 'TRIP'} onPress={() => setServiceType('TRIP')} />
        <OceanChip label="Envoi" active={serviceType === 'SHIPMENT'} onPress={() => setServiceType('SHIPMENT')} />
      </View>

      <TextField
        label="Montant estimé (GNF)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="Ex : 150000"
        style={styles.amountField}
      />

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      {result ? (
        <OceanCard style={styles.resultCard}>
          <AppText variant="xs" color="textSecondary">
            Vous économisez
          </AppText>
          <AppText variant="xl" weight="bold" color={colors.successDark}>
            {formatMoney(result.discountAmount)}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            Montant final : {formatMoney(result.finalAmount)}
          </AppText>
        </OceanCard>
      ) : null}

      <OceanButton label="Vérifier le code" onPress={handleCheck} loading={validatePromoCode.isPending} style={styles.button} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: OCEAN.mist,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  amountField: {
    marginTop: spacing.sm,
  },
  error: {
    marginTop: spacing.sm,
  },
  resultCard: {
    alignItems: 'center',
    gap: 2,
    marginTop: spacing.lg,
  },
  button: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
});