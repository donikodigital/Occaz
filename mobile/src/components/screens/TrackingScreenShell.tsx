// mobile/src/components/screens/TrackingScreenShell.tsx
// [10/10/2026] v1 — Page de suivi d'un colis (chargement, erreur, résultat, actualisation) : même page pour le suivi public et pour
// celui de l'expéditeur, seule la source des données change.
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { IconRefresh } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { ShipmentTrackingView } from '@/components/screens/ShipmentTrackingView';
import { ApiError } from '@/services/api/ApiError';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import type { ShipmentTracking } from '@/types/tracking.types';

export function TrackingScreenShell({
  title,
  subtitle,
  onBack,
  tracking,
  isLoading,
  error,
  onRefresh,
  isRefreshing,
  footer,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  tracking: ShipmentTracking | undefined;
  isLoading: boolean;
  error: unknown;
  onRefresh: () => void;
  isRefreshing: boolean;
  footer?: React.ReactNode;
}) {
  const message = error instanceof ApiError ? error.message : error ? "Le suivi n'a pas pu être chargé — réessayez." : null;

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title={title} subtitle={subtitle} onBack={onBack} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={OCEAN.base} />
        </View>
      ) : null}

      {!isLoading && !tracking ? (
        <OceanCard style={styles.errorCard}>
          <AppText variant="base" weight="semibold" color={OCEAN.deep}>
            Colis introuvable
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {message ?? 'Aucun colis ne correspond à ce numéro.'}
          </AppText>
          <OceanButton label="Réessayer" variant="soft" icon={<IconRefresh size={16} color={OCEAN.base} />} onPress={onRefresh} loading={isRefreshing} />
        </OceanCard>
      ) : null}

      {tracking ? (
        <>
          <ShipmentTrackingView tracking={tracking} />
          {tracking.outcome === 'ACTIVE' ? (
            <OceanButton
              label="Actualiser"
              variant="outline"
              icon={<IconRefresh size={16} color={OCEAN.base} />}
              onPress={onRefresh}
              loading={isRefreshing}
            />
          ) : null}
          {tracking.outcome === 'ACTIVE' ? (
            <AppText variant="xs" color="textSecondary" align="center">
              Cette page se met à jour toute seule.
            </AppText>
          ) : null}
        </>
      ) : null}

      {footer}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: spacing.xxl },
  errorCard: { gap: spacing.sm },
});
