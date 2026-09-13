// mobile/src/components/ui/DriverPositionCard.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconMapPinFilled } from '@tabler/icons-react-native';
import { AppText, Button, Card } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useTripPosition } from '@/hooks/useTripPosition';
import { formatRelativeTime } from '@/utils/date';
import { openInMaps } from '@/utils/maps';

export interface DriverPositionCardProps {
  tripId: string;
  /** N'affiche/n'interroge la position que pendant un trajet réellement en cours. */
  isActive: boolean;
}

/** N'affiche rien tant qu'aucune position n'est encore connue (trajet pas encore démarré, ou chauffeur pas encore localisé) — pas de carte vide trompeuse. */
export function DriverPositionCard({ tripId, isActive }: DriverPositionCardProps) {
  const { data: position } = useTripPosition(tripId, isActive);

  if (!isActive || !position) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <IconMapPinFilled size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="sm" weight="semibold">
            Position du chauffeur
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Mise à jour {formatRelativeTime(position.updatedAt)}
          </AppText>
        </View>
      </View>
      <Button
        label="Ouvrir dans Plans"
        variant="secondary"
        onPress={() => openInMaps(position.latitude, position.longitude)}
        fullWidth={false}
        style={styles.button}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignSelf: 'flex-start',
  },
});
