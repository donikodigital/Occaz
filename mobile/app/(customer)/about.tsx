// mobile/app/(customer)/about.tsx
//
// v1 — Infos sur l'app : version (lue dynamiquement), liens vers les
// conditions générales et la protection des données.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { IconFileText, IconRoute, IconShieldLock } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

export default function AboutScreen() {
  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Infos sur l'app" onBack={() => router.back()} />

      <View style={styles.hero}>
        <View style={styles.logo}>
          <IconRoute size={30} color={OCEAN.onDark} />
        </View>
        <AppText variant="lg" weight="bold" color={OCEAN.deep}>
          Occaz
        </AppText>
        <AppText variant="sm" color="textSecondary">
          Version {appVersion}
        </AppText>
      </View>

      <OceanCard onPress={() => router.push('/(customer)/terms')} style={styles.row} accessibilityLabel="Conditions générales">
        <IconFileText size={18} color={OCEAN.base} />
        <AppText variant="sm" weight="semibold" style={{ flex: 1 }}>
          Conditions générales
        </AppText>
      </OceanCard>

      <OceanCard onPress={() => router.push('/(customer)/privacy')} style={styles.row} accessibilityLabel="Protection des données">
        <IconShieldLock size={18} color={OCEAN.base} />
        <AppText variant="sm" weight="semibold" style={{ flex: 1 }}>
          Protection des données
        </AppText>
      </OceanCard>

      <AppText variant="xs" color="textMuted" align="center" style={styles.copyright}>
        © {new Date().getFullYear()} Occaz — Tous droits réservés
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.lg,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: OCEAN.deep,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  copyright: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});