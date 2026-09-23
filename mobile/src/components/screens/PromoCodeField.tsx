// mobile/src/components/screens/PromoCodeField.tsx
//
// v1 — Champ « Code promo » partagé par la création d'un envoi et la
// réservation d'un trajet : saisie + bouton Appliquer, aperçu de la
// réduction (POST /promo-codes/validate), sans rien consacrer — la
// consécration réelle se fait côté serveur, à la création de la
// réservation/de l'envoi (voir BookingsService/ShipmentsService.create).

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconCheck, IconDiscount2, IconX } from '@tabler/icons-react-native';
import { AppText, TextField } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useValidatePromoCode } from '@/hooks/usePromotions';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import type { ServiceType } from '@/types/promotions.types';

export interface PromoCodeFieldProps {
  serviceType: ServiceType;
  /** Montant courant (avant réduction), en plus petite unité — null tant que le formulaire n'est pas assez rempli pour le connaître. */
  amount: string | null;
  /** Code effectivement appliqué (vérifié avec succès) — undefined tant qu'aucun code n'est validé. */
  appliedCode: string | undefined;
  onChange: (code: string | undefined) => void;
}

export function PromoCodeField({ serviceType, amount, appliedCode, onChange }: PromoCodeFieldProps) {
  const [input, setInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const validatePromoCode = useValidatePromoCode();

  function handleApply() {
    setErrorMessage(undefined);
    if (!input.trim()) return;
    if (!amount) {
      setErrorMessage('Complétez le formulaire pour connaître le montant avant d’appliquer un code.');
      return;
    }
    validatePromoCode.mutate(
      { code: input.trim().toUpperCase(), serviceType, amount },
      {
        onSuccess: () => onChange(input.trim().toUpperCase()),
        onError: (error) => setErrorMessage(error instanceof ApiError ? error.message : 'Code invalide.'),
      },
    );
  }

  function handleRemove() {
    onChange(undefined);
    setInput('');
    validatePromoCode.reset();
  }

  if (appliedCode) {
    return (
      <View style={styles.appliedRow}>
        <View style={styles.appliedIcon}>
          <IconCheck size={16} color={colors.successDark} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="sm" weight="semibold" color={colors.successDark}>
            Code {appliedCode} appliqué
          </AppText>
          {validatePromoCode.data ? (
            <AppText variant="xs" color="textSecondary">
              − {formatMoney(validatePromoCode.data.discountAmount)}
            </AppText>
          ) : null}
        </View>
        <OceanButton label="" icon={<IconX size={16} color={OCEAN.base} />} variant="outline" onPress={handleRemove} style={styles.removeButton} />
      </View>
    );
  }

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.input}>
          <TextField
            label="Code promo (optionnel)"
            value={input}
            onChangeText={(t) => setInput(t.toUpperCase())}
            placeholder="BIENVENUE10"
            autoCapitalize="characters"
            leftIcon={<IconDiscount2 size={16} color={OCEAN.base} />}
          />
        </View>
        <OceanButton label="Appliquer" variant="soft" onPress={handleApply} loading={validatePromoCode.isPending} style={styles.applyButton} />
      </View>
      {errorMessage ? (
        <AppText variant="xs" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
  },
  applyButton: {
    marginBottom: 2,
  },
  error: {
    marginTop: spacing.xxs,
  },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    borderRadius: 14,
    padding: spacing.sm + 2,
  },
  appliedIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
});