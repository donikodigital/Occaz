// mobile/src/components/screens/ShipmentParcelCosts.tsx
// [10/10/2026] v1 — Coût de chaque colis, majoration d'urgence (une seule fois) et total, à la dernière étape de l'envoi. Les montants
// viennent du devis du serveur : rien n'est recalculé sur l'appareil.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { OceanCard } from '@/components/ocean/OceanKit';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { formatMoney } from '@/utils/money';
import type { ShipmentQuote } from '@/types/shipments.types';

function Line({ label, hint, value, bold }: { label: string; hint?: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.line}>
      <View style={styles.lineLabel}>
        <AppText variant="sm" weight={bold ? 'bold' : 'semibold'} color={bold ? OCEAN.deep : 'textPrimary'} numberOfLines={1}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="xs" color="textSecondary" numberOfLines={1}>
            {hint}
          </AppText>
        ) : null}
      </View>
      <AppText variant={bold ? 'md' : 'sm'} weight="bold" color={OCEAN.deep} numberOfLines={1}>
        {value}
      </AppText>
    </View>
  );
}

export function ShipmentParcelCosts({
  quote,
  labels,
}: {
  quote: ShipmentQuote;
  /** Libellé de chaque colis, dans l'ordre (ex. « Vêtements »). À défaut : « Colis 1 », « Colis 2 »… */
  labels?: (string | undefined)[];
}) {
  const parcels = quote.parcels ?? [];
  if (parcels.length === 0) return null;
  const currency = quote.currencyCode ?? undefined;
  const urgent = Number(quote.urgentSurcharge ?? 0);

  return (
    <OceanCard style={styles.card}>
      <AppText variant="xs" weight="bold" color={OCEAN.base} style={styles.title}>
        COÛT DE CHAQUE COLIS
      </AppText>
      {parcels.map((parcel) => (
        <Line
          key={parcel.index}
          label={labels?.[parcel.index - 1]?.trim() || `Colis ${parcel.index}`}
          hint={parcel.weightKg ? `${parcel.weightKg} kg` : undefined}
          value={formatMoney(parcel.price, currency)}
        />
      ))}
      {urgent > 0 ? <Line label="Envoi urgent" hint="Une seule majoration pour tout l'envoi" value={formatMoney(urgent, currency)} /> : null}
      <View style={styles.separator} />
      <Line label="Total" value={formatMoney(quote.totalAmount, currency)} bold />
    </OceanCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  title: {
    letterSpacing: 0.8,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  lineLabel: {
    flex: 1,
    gap: 1,
  },
  separator: {
    height: 1,
    backgroundColor: OCEAN.line,
  },
});
