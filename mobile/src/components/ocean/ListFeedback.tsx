// mobile/src/components/ocean/ListFeedback.tsx
// [25/10/2026] v1 — États d'une liste chargée depuis le serveur : chargement, échec (avec « Réessayer ») et « charger la suite ».
// Avant, un échec réseau s'affichait comme « Aucune réservation », ce qui faisait croire à une perte de données.
import React from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { IconWifiOff } from '@tabler/icons-react-native';
import { OceanButton, OceanEmpty } from '@/components/ocean/OceanKit';
import { OCEAN } from '@/theme/ocean';
import { spacing } from '@/theme';

export function ListLoading() {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel="Chargement">
      <ActivityIndicator color={OCEAN.base} />
    </View>
  );
}

export function ListFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <OceanEmpty
      icon={<IconWifiOff size={28} color={OCEAN.base} />}
      title="Impossible de charger la liste"
      text="Vos données sont en sécurité. Vérifiez votre connexion puis réessayez."
      action={<OceanButton label="Réessayer" onPress={onRetry} style={styles.retry} />}
    />
  );
}

export function ListMoreFooter({ loading }: { loading: boolean }) {
  return loading ? (
    <View style={styles.more}>
      <ActivityIndicator color={OCEAN.base} />
    </View>
  ) : null;
}

/** Tirer l'écran vers le bas pour actualiser. */
export function listRefreshControl(refreshing: boolean, onRefresh: () => void) {
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={OCEAN.base} colors={[OCEAN.base]} />;
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  more: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  retry: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
});
