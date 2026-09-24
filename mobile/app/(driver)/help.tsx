// mobile/app/(driver)/help.tsx
//
// v1 — « Obtenir de l'aide » : contacter le support par email (nouveau,
// demandé explicitement), puis les rubriques Centre de sécurité, FAQ,
// Conditions générales, Infos sur l'app et Supprimer le compte — même
// classement que chez CityGo, contenu et design propres à Occaz.

import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import {
  IconChevronRight,
  IconFileText,
  IconInfoCircle,
  IconMail,
  IconQuestionMark,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanScreenHeader, OceanSection } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

/** Adresse support fournie par Doniko. */
const SUPPORT_EMAIL = 'Doniko.digital@gmail.com';

interface RowProps {
  icon: React.ReactNode;
  iconBackground: string;
  label: string;
  onPress: () => void;
  isLast?: boolean;
  danger?: boolean;
}

function Row({ icon, iconBackground, label, onPress, isLast, danger }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBackground }]}>{icon}</View>
      <AppText variant="sm" weight="semibold" color={danger ? 'danger' : 'textPrimary'} style={styles.rowLabel}>
        {label}
      </AppText>
      <IconChevronRight size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export default function HelpScreen() {
  function contactSupport() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Besoin d’aide — Occaz')}`);
  }

  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Obtenir de l'aide" onBack={() => router.back()} />

      <OceanSection icon={<IconMail size={17} color={OCEAN.base} />} title="Nous contacter">
        <Row
          icon={<IconMail size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Contacter le support par email"
          onPress={contactSupport}
          isLast
        />
      </OceanSection>

      <OceanSection icon={<IconShieldCheck size={17} color={OCEAN.base} />} title="Ressources">
        <Row
          icon={<IconShieldCheck size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Centre de sécurité"
          onPress={() => router.push('/(driver)/safety-center')}
        />
        <Row
          icon={<IconQuestionMark size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Questions fréquentes"
          onPress={() => router.push('/(driver)/faq')}
        />
        <Row
          icon={<IconFileText size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Conditions générales"
          onPress={() => router.push('/(driver)/terms')}
        />
        <Row
          icon={<IconInfoCircle size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Infos sur l'app"
          onPress={() => router.push('/(driver)/about')}
          isLast
        />
      </OceanSection>

      <OceanSection icon={<IconTrash size={17} color={colors.dangerDark} />} title="Compte">
        <Row
          icon={<IconTrash size={18} color={colors.dangerDark} />}
          iconBackground={colors.dangerLight}
          label="Supprimer votre compte"
          onPress={() => router.push('/(driver)/delete-account')}
          danger
          isLast
        />
      </OceanSection>

      <AppText variant="xs" color="textMuted" align="center" style={styles.version}>
        Version {appVersion}
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: OCEAN.line,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
  },
  version: {
    marginBottom: spacing.xl,
  },
});