// mobile/app/(auth)/onboarding.tsx
// [22/09/2026] v2 — Habillage bleu Ocean, dans l'esprit Tiime : icône posée
// sur un aplat doux à étincelles (AuthIllustration) au lieu du carré plein
// indigo, cartes de rôle arrondies avec ombre douce, typographie plus
// généreuse. Logique inchangée.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowRight, IconRoute, IconSteeringWheel, IconUser } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { AuthIllustration } from '@/components/illustrations/AuthIllustration';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import type { AccountType } from '@/types/auth.types';

interface RoleOptionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBackground: string;
  tone: 'ocean' | 'surface';
  onPress: () => void;
}

function RoleOption({ title, subtitle, icon, iconBackground, tone, onPress }: RoleOptionProps) {
  const isOcean = tone === 'ocean';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        isOcean ? styles.optionOcean : styles.optionSurface,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: iconBackground }]}>{icon}</View>
      <View style={styles.optionText}>
        <AppText variant="md" weight="semibold" color={isOcean ? OCEAN.onDark : 'textPrimary'}>
          {title}
        </AppText>
        <AppText variant="sm" color={isOcean ? OCEAN.sky : 'textSecondary'}>
          {subtitle}
        </AppText>
      </View>
      <IconArrowRight size={18} color={isOcean ? OCEAN.onDark : colors.textPrimary} />
    </Pressable>
  );
}

export default function OnboardingScreen() {
  function selectRole(accountType: AccountType) {
    router.push({ pathname: '/(auth)/login', params: { accountType } });
  }

  return (
    <ScreenContainer style={styles.container} maxWidth="form">
      <View style={styles.hero}>
        <AuthIllustration icon={<IconRoute size={28} color={OCEAN.onDark} />} />
        <AppText variant="xxl" weight="bold" color={OCEAN.deep} align="center" style={styles.title}>
          Bienvenue
        </AppText>
        <AppText variant="base" color="textSecondary" align="center" style={styles.tagline}>
          Trajets partagés et envois de colis,{'\n'}partout où vous allez.
        </AppText>
      </View>

      <View style={styles.options}>
        <RoleOption
          title="Je suis client"
          subtitle="Réserver un trajet ou un envoi"
          icon={<IconUser size={19} color={OCEAN.onDark} />}
          iconBackground="rgba(255,255,255,0.16)"
          tone="ocean"
          onPress={() => selectRole('CUSTOMER')}
        />
        <RoleOption
          title="Je suis chauffeur"
          subtitle="Rentabiliser mes trajets"
          icon={<IconSteeringWheel size={19} color={colors.successDark} />}
          iconBackground={colors.successLight}
          tone="surface"
          onPress={() => selectRole('DRIVER')}
        />
      </View>

      <Pressable onPress={() => router.push({ pathname: '/(auth)/login' })} style={styles.loginLink}>
        <AppText variant="sm" color="textSecondary" align="center">
          Déjà inscrit ?{' '}
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            Se connecter
          </AppText>
        </AppText>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    marginTop: spacing.lg,
  },
  tagline: {
    marginTop: spacing.xxs,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
  },
  optionOcean: {
    backgroundColor: OCEAN.deep,
    borderColor: OCEAN.deep,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  optionSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  loginLink: {
    marginTop: spacing.xl,
  },
});