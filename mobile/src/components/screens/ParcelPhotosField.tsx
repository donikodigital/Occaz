// mobile/src/components/screens/ParcelPhotosField.tsx
// [19/10/2026] v1 — Section « Photos du colis » du formulaire d'envoi : 2 photos au plus (appareil photo ou galerie), aperçu, retrait,
// nouvel essai si l'envoi a échoué. Les photos partent au stockage dès qu'elles sont prises ; le formulaire n'en garde que les clés.
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { IconAlertTriangle, IconCamera, IconPhoto, IconRefresh, IconX } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { MAX_PARCEL_PHOTOS } from '@/types/shipmentPhotos.types';
import type { ParcelPhotoDrafts } from '@/hooks/useShipmentPhotos';

export function ParcelPhotosField({ drafts }: { drafts: ParcelPhotoDrafts }) {
  const { photos, error, canAddMore, pickFromCamera, pickFromLibrary, remove, retry } = drafts;
  const emptySlots = Math.max(0, MAX_PARCEL_PHOTOS - photos.length);

  return (
    <View style={styles.root}>
      <AppText variant="xs" color="textSecondary">
        Jusqu'à {MAX_PARCEL_PHOTOS} photos de votre colis. Le conducteur les voit avant d'accepter, puis tout au long de l'envoi ; le
        support Occa'Z peut les consulter en cas de litige.
      </AppText>

      <View style={styles.row}>
        {photos.map((photo, index) => (
          <View key={photo.localId} style={styles.slot} accessibilityLabel={`Photo ${index + 1} du colis`}>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {photo.status === 'uploading' ? (
              <View style={styles.overlay}>
                <ActivityIndicator color={colors.onPrimary} />
                <AppText variant="xs" weight="semibold" color={colors.onPrimary}>
                  Envoi…
                </AppText>
              </View>
            ) : null}
            {photo.status === 'error' ? (
              <Pressable
                onPress={() => retry(photo.localId)}
                accessibilityRole="button"
                accessibilityLabel="Réessayer l'envoi de la photo"
                style={[styles.overlay, styles.overlayError]}
              >
                <IconAlertTriangle size={20} color={colors.onPrimary} />
                <AppText variant="xs" weight="semibold" color={colors.onPrimary} style={styles.center}>
                  Échec de l'envoi
                </AppText>
                <View style={styles.retry}>
                  <IconRefresh size={13} color={colors.onPrimary} />
                  <AppText variant="xs" weight="bold" color={colors.onPrimary}>
                    Réessayer
                  </AppText>
                </View>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => remove(photo.localId)}
              accessibilityRole="button"
              accessibilityLabel={`Retirer la photo ${index + 1}`}
              hitSlop={8}
              style={({ pressed }) => [styles.remove, pressed && styles.pressed]}
            >
              <IconX size={14} color={colors.onPrimary} />
            </Pressable>
          </View>
        ))}
        {Array.from({ length: emptySlots }).map((_, index) => (
          <View key={`empty-${index}`} style={[styles.slot, styles.emptySlot]}>
            <IconPhoto size={26} color={OCEAN.base} />
            <AppText variant="xs" color="textSecondary">
              Photo {photos.length + index + 1}
            </AppText>
          </View>
        ))}
      </View>

      {canAddMore ? (
        <View style={styles.actions}>
          <View style={styles.action}>
            <OceanButton label="Appareil photo" variant="soft" icon={<IconCamera size={16} color={OCEAN.base} />} onPress={pickFromCamera} />
          </View>
          <View style={styles.action}>
            <OceanButton label="Galerie" variant="outline" icon={<IconPhoto size={16} color={OCEAN.base} />} onPress={pickFromLibrary} />
          </View>
        </View>
      ) : (
        <AppText variant="xs" color="textSecondary">
          {MAX_PARCEL_PHOTOS} photos ajoutées. Retirez-en une pour en choisir une autre.
        </AppText>
      )}

      {error ? (
        <AppText variant="xs" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const SLOT_SIZE = 132;

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: OCEAN.mist,
  },
  emptySlot: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: OCEAN.line,
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(8,58,99,0.55)',
  },
  overlayError: { backgroundColor: 'rgba(160,30,30,0.72)', padding: spacing.xs },
  center: { textAlign: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,58,99,0.75)',
  },
  pressed: { opacity: 0.7 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
});
