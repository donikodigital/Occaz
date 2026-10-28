// mobile/app/(customer)/shipment-tracking.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] v2 — padding ajouté à la carte « Copiez ce message » (OceanCard n'a pas de padding de base : le texte touchait le cadre).
// [10/10/2026] v1 — Suivi en direct d'un envoi pour son expéditeur : position exacte du colis, villes traversées, historique daté, et
// partage du numéro (ou du lien) de suivi avec le destinataire.
import React, { useState } from 'react';
import { Share, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconShare } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { OceanButton, OceanCard } from '@/components/ocean/OceanKit';
import { TrackingScreenShell } from '@/components/screens/TrackingScreenShell';
import { useMyShipmentTracking } from '@/hooks/useShipmentTracking';
import { formatTrackingNumber, trackingLink } from '@/utils/tracking';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useT } from '@/i18n';

export default function ShipmentTrackingScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useMyShipmentTracking(id);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  async function share() {
    if (!query.data) return;
    const number = query.data.trackingNumber;
    const link = trackingLink(number);
    const text = link
      ? t('Suivez mon colis Occa’Z ({pickupCity} → {deliveryCity}) : {link}\nNuméro de suivi : {trackingNumber}', { pickupCity: query.data.pickupCity, deliveryCity: query.data.deliveryCity, link, trackingNumber: formatTrackingNumber(number) })
      : t('Suivez mon colis Occa’Z ({pickupCity} → {deliveryCity}) avec le numéro de suivi {trackingNumber} : application Occa’Z, « Suivre un colis ».', { pickupCity: query.data.pickupCity, deliveryCity: query.data.deliveryCity, trackingNumber: formatTrackingNumber(number) });
    try {
      await Share.share({ message: text });
      setShareMessage(null);
    } catch {
      // Pas de partage système (navigateur sans cette fonction) : on affiche le texte à recopier, dans la page.
      setShareMessage(text);
    }
  }

  return (
    <TrackingScreenShell
      title={t('Suivi en direct')}
      subtitle={query.data ? `${query.data.pickupCity} → ${query.data.deliveryCity}` : undefined}
      onBack={() => router.back()}
      tracking={query.data}
      isLoading={query.isLoading}
      error={query.error}
      onRefresh={() => void query.refetch()}
      isRefreshing={query.isFetching}
      footer={
        query.data ? (
          <>
            <OceanButton
              label={t('Partager le suivi avec le destinataire')}
              variant="soft"
              icon={<IconShare size={16} color={OCEAN.base} />}
              onPress={() => void share()}
            />
            {shareMessage ? (
              <OceanCard style={styles.shareCard}>
                <AppText variant="xs" color="textSecondary">
                  {t('Copiez ce message pour l’envoyer :')}
                </AppText>
                <AppText variant="sm" selectable>
                  {shareMessage}
                </AppText>
              </OceanCard>
            ) : null}
          </>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  shareCard: { gap: spacing.xs, padding: spacing.md },
});