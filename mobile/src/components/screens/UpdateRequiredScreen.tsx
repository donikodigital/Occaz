// mobile/src/components/screens/UpdateRequiredScreen.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [19/10/2026] v1 — Écran plein écran « Mise à jour requise » : affiché à la place de l'application quand sa version est plus ancienne que la
// version minimale réglée dans le back-office (app.min_version). Sert à retirer d'un coup une version cassée ou dangereuse, sans attendre
// que les gens se mettent à jour d'eux-mêmes. Le bouton ouvre la fiche de l'application (Google Play / App Store).
import React from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { IconDownload } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { OCEAN } from '@/theme/ocean';
import { spacing } from '@/theme';
import { useT } from '@/i18n';

export function UpdateRequiredScreen({ storeUrl }: { storeUrl: string | null }) {
  const t = useT();
  return (
    <ScreenContainer maxWidth="form">
      <View style={styles.body}>
        <View style={styles.icon}>
          <IconDownload size={40} color={OCEAN.base} />
        </View>
        <AppText variant="xxl" weight="bold" align="center" color={OCEAN.deep}>
          {t('Mise à jour requise')}
        </AppText>
        <AppText variant="base" color="textSecondary" align="center">
          {t("Cette version d'Occa'Z n'est plus prise en charge. Installez la dernière version pour continuer à réserver, voyager et suivre vos envois en toute sécurité.")}
        </AppText>
        {storeUrl ? null : (
          <AppText variant="sm" color="textSecondary" align="center">
            {t("Ouvrez {value} et recherchez « Occa'Z » pour la mettre à jour.", { value: Platform.OS === 'ios' ? t("l'App Store") : t('le Play Store') })}
          </AppText>
        )}
      </View>
      {storeUrl ? (
        <OceanButton label={t('Mettre à jour')} onPress={() => void Linking.openURL(storeUrl)} style={styles.button} />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  icon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  button: {
    marginBottom: spacing.md,
  },
});
