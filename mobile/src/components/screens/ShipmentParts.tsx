// mobile/src/components/screens/ShipmentParts.tsx
// [21/09/2026] v1 — itinéraire et pastilles partagés par les écrans d'envoi.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

/**
 * Itinéraire à la verticale : rond creux au départ, carré plein à
 * l'arrivée, relié par un trait. Utilisé par la carte de la liste et par la
 * feuille d'acceptation, pour que l'envoi se lise pareil aux deux endroits.
 */
export function ShipmentRoute({ from, to }: { from: string; to: string }) {
  return (
    <View style={styles.route}>
      <View style={styles.rail}>
        <View style={styles.dotFrom} />
        <View style={styles.line} />
        <View style={styles.dotTo} />
      </View>
      <View style={styles.labels}>
        <AppText variant="sm" weight="medium" numberOfLines={1}>
          {from}
        </AppText>
        <AppText variant="sm" weight="medium" numberOfLines={1}>
          {to}
        </AppText>
      </View>
    </View>
  );
}

/** Petite pastille grise : poids, dimensions, quantité. */
export function FactChip({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <View style={styles.chip}>
      {icon}
      <AppText variant="xs" weight="medium" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  route: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rail: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dotFrom: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  line: {
    flex: 1,
    width: 2,
    minHeight: 14,
    marginVertical: 3,
    borderRadius: 1,
    backgroundColor: colors.borderStrong,
  },
  dotTo: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  labels: {
    flex: 1,
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
});