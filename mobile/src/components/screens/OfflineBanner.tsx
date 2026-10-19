// mobile/src/components/screens/OfflineBanner.tsx
// [19/10/2026] v1 — Bandeau « Pas de connexion » en haut de l'écran, affiché seulement quand le réseau est coupé. Il ne bloque rien : les
// données déjà chargées restent visibles, et tout se recharge tout seul au retour du réseau (useConnectivityProbe).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconWifiOff } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { spacing } from '@/theme';
import { useConnectivityStore } from '@/stores/connectivityStore';
import { useConnectivityProbe } from '@/hooks/useConnectivityProbe';

export function OfflineBanner() {
  const offline = useConnectivityStore((state) => state.offline);
  const insets = useSafeAreaInsets();
  useConnectivityProbe();

  if (!offline) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.banner, { paddingTop: insets.top + spacing.xs }]}
    >
      <IconWifiOff size={16} color="#FFFFFF" />
      <AppText variant="xs" weight="semibold" color="#FFFFFF" style={styles.text}>
        Pas de connexion — les données se rechargeront dès que le réseau reviendra.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: '#B45309',
  },
  text: {
    flexShrink: 1,
    textAlign: 'center',
  },
});
