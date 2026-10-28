// mobile/src/components/screens/ShipmentPhotosGallery.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [19/10/2026] v1 — Les photos du colis (2 au plus), visibles de bout en bout : expéditeur, conducteur (avant et après acceptation) et
// support. Vignettes ; un appui ouvre la photo en grand. Rien ne s'affiche s'il n'y a pas de photo ou si l'accès est refusé : un envoi
// sans photo reste un envoi normal.
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconCamera, IconX } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { OceanSection } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useShipmentPhotos } from '@/hooks/useShipmentPhotos';
import { useT } from '@/i18n';

export interface ShipmentPhotosGalleryProps {
  shipmentId: string | undefined;
  /** `section` : carte « PHOTOS DU COLIS » (écrans de détail). `plain` : les vignettes seules, dans un conteneur existant (feuille d'acceptation). */
  variant?: 'section' | 'plain';
}

export function ShipmentPhotosGallery({ shipmentId, variant = 'section' }: ShipmentPhotosGalleryProps) {
  const t = useT();
  const { data: photos } = useShipmentPhotos(shipmentId);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!photos || photos.length === 0) return null;

  const thumbnails = (
    <View style={styles.row}>
      {photos.map((photo, index) => (
        <Pressable
          key={photo.id}
          onPress={() => setOpenIndex(index)}
          accessibilityRole="imagebutton"
          accessibilityLabel={t('Voir la photo {value} du colis en grand', { value: index + 1 })}
          style={({ pressed }) => [styles.thumb, pressed && styles.pressed]}
        >
          <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        </Pressable>
      ))}
    </View>
  );

  const viewer = (
    <Modal visible={openIndex !== null} transparent animationType="fade" onRequestClose={() => setOpenIndex(null)}>
      <SafeAreaView style={styles.viewer}>
        <Pressable
          onPress={() => setOpenIndex(null)}
          accessibilityRole="button"
          accessibilityLabel={t('Fermer la photo')}
          hitSlop={12}
          style={styles.close}
        >
          <IconX size={22} color={colors.onPrimary} />
        </Pressable>
        {openIndex !== null && photos[openIndex] ? (
          <Pressable style={styles.viewerBody} onPress={() => setOpenIndex(null)} accessibilityLabel={t('Photo du colis')}>
            <Image source={{ uri: photos[openIndex].url }} style={styles.full} contentFit="contain" />
          </Pressable>
        ) : null}
        <View style={styles.dots}>
          {photos.map((photo, index) => (
            <Pressable
              key={photo.id}
              onPress={() => setOpenIndex(index)}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${index + 1}`}
              hitSlop={8}
              style={[styles.dot, index === openIndex && styles.dotActive]}
            />
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (variant === 'plain') {
    return (
      <View style={styles.plain}>
        <AppText variant="sm" weight="semibold">
          {t('Photos du colis')}
        </AppText>
        {thumbnails}
        {viewer}
      </View>
    );
  }

  return (
    <OceanSection icon={<IconCamera size={17} color={OCEAN.base} />} title={t('Photos du colis')}>
      {thumbnails}
      {viewer}
    </OceanSection>
  );
}

const THUMB = 112;

const styles = StyleSheet.create({
  plain: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  thumb: { width: THUMB, height: THUMB, borderRadius: 14, overflow: 'hidden', backgroundColor: OCEAN.mist },
  pressed: { opacity: 0.8 },
  viewer: { flex: 1, backgroundColor: 'rgba(4,20,36,0.96)' },
  close: {
    alignSelf: 'flex-end',
    margin: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  viewerBody: { flex: 1, padding: spacing.sm },
  full: { flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingBottom: spacing.lg },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: colors.onPrimary },
});
