// mobile/app/suivi/[number].tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] v1 — Page PUBLIQUE de suivi d'un colis : accessible sans compte avec le numéro de suivi (lien reçu par e-mail, saisie
// manuelle). La position y est approximative et aucune donnée personnelle n'est montrée.
import React from 'react';
import { StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppText } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { TrackingScreenShell } from '@/components/screens/TrackingScreenShell';
import { usePublicTracking } from '@/hooks/useShipmentTracking';
import { useAuthStore } from '@/stores/authStore';
import { parseTrackingNumber } from '@/utils/tracking';
import { useT } from '@/i18n';

function leave(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function PublicTrackingScreen() {
  const t = useT();
  const { number } = useLocalSearchParams<{ number: string }>();
  const trackingNumber = parseTrackingNumber(String(number ?? ''));
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const query = usePublicTracking(trackingNumber);

  return (
    <TrackingScreenShell
      title={t('Suivi du colis')}
      subtitle={trackingNumber ? undefined : t('Numéro non reconnu')}
      onBack={leave}
      tracking={query.data}
      isLoading={Boolean(trackingNumber) && query.isLoading}
      error={trackingNumber ? query.error : new Error('invalid')}
      onRefresh={() => void query.refetch()}
      isRefreshing={query.isFetching}
      footer={
        <>
          <OceanButton label={t('Suivre un autre colis')} variant="soft" onPress={() => router.replace('/suivi')} />
          {!isAuthenticated ? (
            <AppText variant="xs" color="textSecondary" align="center" style={styles.footnote}>
              {t('Pour envoyer un colis ou réserver un trajet, créez votre compte Occa’Z.')}
            </AppText>
          ) : null}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  footnote: { marginTop: 4 },
});
