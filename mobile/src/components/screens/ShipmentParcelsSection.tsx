// mobile/src/components/screens/ShipmentParcelsSection.tsx
// [10/10/2026] v1 — Liste des colis d'un envoi multiple (poids, dimensions, valeur de chacun ; prix côté client), sous « Voir tous les détails ».
// Rien ne s'affiche pour un envoi d'un seul colis ou créé avant la saisie colis par colis.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconPackage } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { OceanSection } from '@/components/ocean/OceanKit';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { formatMoney } from '@/utils/money';
import type { ShipmentItem } from '@/types/shipments.types';

function describe(item: ShipmentItem, currencyCode: string | undefined, showPrice: boolean): string {
  const hasDimensions = item.lengthCm && item.widthCm && item.heightCm;
  return [
    item.weightKg ? `${item.weightKg} kg` : null,
    hasDimensions ? `${item.lengthCm}×${item.widthCm}×${item.heightCm} cm` : null,
    item.declaredValue && Number(item.declaredValue) > 0 ? `valeur ${formatMoney(item.declaredValue, currencyCode)}` : null,
    showPrice && item.price ? formatMoney(item.price, currencyCode) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function ShipmentParcelsSection({
  items,
  currencyCode,
  showPrice = false,
}: {
  items: ShipmentItem[] | undefined;
  currencyCode?: string;
  /** Côté client seulement : le conducteur n'a pas à voir le prix de chaque colis. */
  showPrice?: boolean;
}) {
  if (!items || items.length < 2) return null;

  return (
    <OceanSection icon={<IconPackage size={17} color={OCEAN.base} />} title={`Colis (${items.length})`}>
      <View style={styles.list}>
        {items.map((item, index) => (
          <View key={item.id} style={styles.row}>
            <AppText variant="sm" weight="semibold" numberOfLines={1}>
              {`Colis ${index + 1}${item.description ? ` · ${item.description}` : ''}`}
            </AppText>
            <AppText variant="xs" color="textSecondary">
              {describe(item, currencyCode, showPrice) || 'Aucun détail'}
            </AppText>
          </View>
        ))}
      </View>
    </OceanSection>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  row: {
    gap: 2,
  },
});
