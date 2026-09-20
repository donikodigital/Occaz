// mobile/src/components/screens/StatCard.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Card } from '@/components/ui';
import { spacing } from '@/theme';

export interface StatCardProps {
  /** Pastille d'icône (StatIconBadge) ou anneau de progression, centré en haut. */
  visual: React.ReactNode;
  /** Valeur sous le visuel — à omettre quand le visuel porte déjà la valeur (ex: anneau). */
  value?: string;
  /** Libellé sur 2 lignes maximum — couper avec "\n" pour maîtriser le retour à la ligne. */
  label: string;
}

/** Icône dans une pastille ronde teintée — le visuel standard d'une StatCard. */
export function StatIconBadge({ icon, background }: { icon: React.ReactNode; background: string }) {
  return <View style={[styles.iconBadge, { backgroundColor: background }]}>{icon}</View>;
}

/**
 * Carte de statistique pour une rangée de 3. Correctif de fond du
 * débordement : la version précédente imposait `aspectRatio: 1` (hauteur
 * figée à la largeur, ~110 px) alors que le contenu — icône, valeur et un
 * libellé qui retombait sur 3-4 lignes — était plus haut, donc il sortait
 * du cadre par le haut et le bas. Ici la hauteur suit le contenu, les
 * cartes d'une même rangée s'alignent d'elles-mêmes (stretch) et le
 * libellé reste calé en bas, sur 2 lignes maximum.
 */
export function StatCard({ visual, value, label }: StatCardProps) {
  return (
    <Card padded={false} style={styles.card}>
      <View style={styles.top}>
        <View style={styles.visual}>{visual}</View>
        {value !== undefined ? (
          <AppText variant="lg" weight="bold">
            {value}
          </AppText>
        ) : null}
      </View>
      <AppText
        variant="xs"
        color="textSecondary"
        align="center"
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        style={styles.label}
      >
        {label}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  top: {
    alignItems: 'center',
    gap: spacing.xxs,
  },
  visual: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    alignSelf: 'stretch',
  },
});