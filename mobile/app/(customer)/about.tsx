// mobile/app/(customer)/about.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] v3 — en-tête en bandeau (héro) bleu océan, comme les autres pages. Le logo et le reste de l'écran sont inchangés.
//
// [10/10/2026] v2 — le vrai logo de l'app (icon.png) remplace le pictogramme générique.
//
// v1 — Infos sur l'app : version (lue dynamiquement), liens vers les
// conditions générales et la protection des données.

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { IconFileText, IconInfoCircle, IconShieldLock } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanCard } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useT } from '@/i18n';

// Même image que l'icône de l'application (app.json).
const APP_LOGO = require('../../assets/images/icon.png');

export default function AboutScreen() {
  const t = useT();
  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanHeroHeader title={t("Infos sur l'app")} subtitle={t('Version, conditions et données')} icon={<IconInfoCircle />} onBack={() => router.back()} />

      <View style={styles.hero}>
        <View style={styles.logoShadow}>
          <Image source={APP_LOGO} resizeMode="cover" style={styles.logo} accessibilityLabel={t('Logo Occaz')} />
        </View>
        <AppText variant="lg" weight="bold" color={OCEAN.deep}>
          {t('Occaz')}
        </AppText>
        <AppText variant="sm" color="textSecondary">
          {t('Version {appVersion}', { appVersion })}
        </AppText>
      </View>

      <OceanCard onPress={() => router.push('/(customer)/terms')} style={styles.row} accessibilityLabel={t('Conditions générales')}>
        <IconFileText size={18} color={OCEAN.base} />
        <AppText variant="sm" weight="semibold" style={{ flex: 1 }}>
          {t('Conditions générales')}
        </AppText>
      </OceanCard>

      <OceanCard onPress={() => router.push('/(customer)/privacy')} style={styles.row} accessibilityLabel={t('Protection des données')}>
        <IconShieldLock size={18} color={OCEAN.base} />
        <AppText variant="sm" weight="semibold" style={{ flex: 1 }}>
          {t('Protection des données')}
        </AppText>
      </OceanCard>

      <AppText variant="xs" color="textMuted" align="center" style={styles.copyright}>
        {t('© {getFullYear} Occaz — Tous droits réservés', { getFullYear: new Date().getFullYear() })}
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
  logoShadow: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: OCEAN.deep,
    marginBottom: spacing.xs,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: 24,
  },
  row: {
    padding: spacing.md,
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

