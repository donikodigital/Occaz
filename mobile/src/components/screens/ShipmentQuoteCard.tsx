// mobile/src/components/screens/ShipmentQuoteCard.tsx
// [21/09/2026] v1 — prix calculé par le serveur, affiché avant paiement.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useShipmentQuote } from '@/hooks/useShipments';
import { ApiError } from '@/services/api/ApiError';
import { formatMoney } from '@/utils/money';
import type { QuoteShipmentPayload } from '@/types/shipments.types';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Prix de l'envoi, calculé par le serveur dès que le formulaire est assez
 * rempli (adresses, catégorie, poids) : distance, poids réel ou volumétrique,
 * valeur déclarée, urgence. Un seul montant à payer. `payload` est `null`
 * tant que le formulaire est incomplet.
 */
export function ShipmentQuoteCard({ payload }: { payload: QuoteShipmentPayload | null }) {
  const debouncedPayload = useDebouncedValue(payload, 500);
  const { data: quote, isFetching, error } = useShipmentQuote(debouncedPayload);

  return (
    <View style={styles.card}>
      <AppText variant="sm" weight="medium" color="textSecondary">
        Prix à payer
      </AppText>

      {payload === null ? (
        <AppText variant="sm" color="textMuted">
          Renseignez les adresses, la catégorie et le poids pour voir le prix.
        </AppText>
      ) : error ? (
        <AppText variant="sm" color="danger">
          {error instanceof ApiError ? error.message : 'Impossible de calculer le prix pour le moment.'}
        </AppText>
      ) : !quote || isFetching ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <AppText variant="sm" color="textSecondary">
            Calcul du prix…
          </AppText>
        </View>
      ) : (
        <>
          <AppText variant="display" weight="bold">
            {formatMoney(quote.totalAmount, quote.currencyCode ?? undefined)}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Distance retenue : {quote.distanceKm} km
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Poids facturé : {quote.chargeableWeightKg} kg
            {quote.volumetricWeightKg !== null && quote.volumetricWeightKg > 0
              ? ` (volume équivalent à ${quote.volumetricWeightKg} kg)`
              : ''}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Paiement unique. Si vous annulez, vous êtes remboursé à 100 %.
          </AppText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.md,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
});