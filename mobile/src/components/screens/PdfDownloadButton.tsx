// mobile/src/components/screens/PdfDownloadButton.tsx
// [10/10/2026] v1 — Bouton « Télécharger… (PDF) » : demande un lien à durée limitée au serveur, puis l'ouvre. Sur téléphone, le PDF s'ouvre
// dans la visionneuse (enregistrer, partager, imprimer) ; sur le web, il se télécharge sans quitter la page. Les erreurs s'affichent
// dans la page (Alert.alert ne fait rien sur le web).
import React, { useState } from 'react';
import { Linking, Platform, StyleSheet } from 'react-native';
import { IconDownload } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { OceanButton, type OceanButtonVariant } from '@/components/ocean/OceanKit';
import { OCEAN } from '@/theme/ocean';
import { spacing } from '@/theme';
import { ticketsApi } from '@/services/api/tickets.api';
import { apiUrl } from '@/services/api/client';
import { ApiError } from '@/services/api/ApiError';

export type PdfKind = 'booking' | 'shipment';

export function PdfDownloadButton({
  kind,
  id,
  label,
  variant = 'soft',
}: {
  kind: PdfKind;
  id: string;
  label: string;
  variant?: OceanButtonVariant;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const link = kind === 'booking' ? await ticketsApi.bookingLink(id) : await ticketsApi.shipmentLink(id);
      if (Platform.OS === 'web') {
        // `dl=1` : le serveur répond en téléchargement direct — la page de l'application reste ouverte.
        window.location.assign(apiUrl(link.path, { dl: 1 }));
      } else {
        await Linking.openURL(apiUrl(link.path));
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Le téléchargement n'a pas pu démarrer — réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <OceanButton
        label={label}
        variant={variant}
        onPress={download}
        loading={loading}
        icon={<IconDownload size={16} color={OCEAN.base} />}
        style={styles.button}
      />
      {error ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: spacing.xs,
  },
  error: {
    marginTop: spacing.xs,
  },
});
