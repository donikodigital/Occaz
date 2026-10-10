// mobile/app/(customer)/promo-code.tsx
// [10/10/2026] v4 — Plus aucun montant à saisir : le code suffit. On le saisit, on voit ce qu'il offre (réduction en % ou en montant, plafond,
// minimum d'achat, prestations concernées, date de fin). Le type de prestation n'est pas demandé non plus : c'est le code qui le porte.
// Le contrôle se fait via POST /promo-codes/lookup. Le calcul de l'économie sur un montant reste au paiement (PromoCodeField).
//
// [07/10/2026] Le titre de la page passe en bandeau (hero) bleu océan : OceanHeroHeader.
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
import { OceanButton, OceanCard } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useLookupPromoCode } from '@/hooks/usePromotions';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import type { PromoCodeTerms, ServiceType } from '@/types/promotions.types';

/** Ce que le code offre, en gros : « 10 % » ou « 5 000 GNF ». */
function offerLabel(terms: PromoCodeTerms): string {
  if (terms.discountType === 'PERCENTAGE') {
    return `${new Intl.NumberFormat('fr-FR').format(terms.discountValue)} %`;
  }
  return formatMoney(terms.discountValue, terms.currencyCode ?? '');
}

function scopeLabel(serviceType: ServiceType | null): string {
  if (serviceType === 'TRIP') return 'les trajets';
  if (serviceType === 'SHIPMENT') return 'les envois';
  return 'les trajets et les envois';
}

function formatEndDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default function PromoCodeScreen() {
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const lookupPromoCode = useLookupPromoCode();

  const terms = lookupPromoCode.data;

  function handleChangeCode(text: string) {
    setCode(text.toUpperCase());
    // Un autre code : l'ancien résultat ne le concerne plus.
    if (terms || errorMessage) {
      lookupPromoCode.reset();
      setErrorMessage(undefined);
    }
  }

  function handleCheck() {
    setErrorMessage(undefined);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setErrorMessage('Renseignez votre code promo.');
      return;
    }
    lookupPromoCode.mutate(
      { code: trimmed },
      { onError: (error) => setErrorMessage(error instanceof ApiError ? error.message : 'Code invalide.') },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanHeroHeader title="Saisir un code promo" icon={<IconDiscount2 />} onBack={() => router.back()} />

      <View style={styles.hero}>
        <IconDiscount2 size={22} color={OCEAN.base} />
        <AppText variant="sm" color="textSecondary" style={{ flex: 1 }}>
          Entrez votre code pour voir ce qu'il vous offre.
        </AppText>
      </View>

      <TextField
        label="Code promo"
        value={code}
        onChangeText={handleChangeCode}
        placeholder="BIENVENUE10"
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={handleCheck}
      />

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <OceanButton label="Vérifier le code" onPress={handleCheck} loading={lookupPromoCode.isPending} style={styles.button} />

      {terms ? (
        <OceanCard style={styles.resultCard}>
          <AppText variant="xs" color="textSecondary">
            Ce code vous offre
          </AppText>
          <AppText variant="xl" weight="bold" color={colors.successDark}>
            {offerLabel(terms)}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            de réduction
          </AppText>
          {terms.description ? (
            <AppText variant="sm" align="center" style={styles.description}>
              {terms.description}
            </AppText>
          ) : null}

          <View style={styles.conditions}>
            <AppText variant="xs" color="textSecondary">
              Valable sur {scopeLabel(terms.serviceType)}
            </AppText>
            {terms.discountType === 'PERCENTAGE' && terms.maxDiscountAmount ? (
              <AppText variant="xs" color="textSecondary">
                Réduction plafonnée à {formatMoney(terms.maxDiscountAmount, terms.currencyCode ?? '')}
              </AppText>
            ) : null}
            {terms.minAmount ? (
              <AppText variant="xs" color="textSecondary">
                À partir de {formatMoney(terms.minAmount, terms.currencyCode ?? '')} d'achat
              </AppText>
            ) : null}
            {terms.expiresAt ? (
              <AppText variant="xs" color="textSecondary">
                Jusqu'au {formatEndDate(terms.expiresAt)}
              </AppText>
            ) : null}
          </View>
        </OceanCard>
      ) : null}
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
  error: {
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.lg,
  },
  resultCard: {
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  description: {
    marginTop: spacing.xs,
  },
  conditions: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 3,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: OCEAN.line,
  },
});