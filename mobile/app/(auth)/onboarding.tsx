// mobile/app/(auth)/onboarding.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowRight, IconRoute, IconSteeringWheel, IconUser } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { AccountType } from '@/types/auth.types';

interface RoleOptionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBackground: string;
  tone: 'primary' | 'surface';
  onPress: () => void;
}

function RoleOption({ title, subtitle, icon, iconBackground, tone, onPress }: RoleOptionProps) {
  const isPrimary = tone === 'primary';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: isPrimary ? colors.primary : colors.surface,
          borderColor: isPrimary ? colors.primary : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: iconBackground }]}>{icon}</View>
      <View style={styles.optionText}>
        <AppText variant="md" weight="semibold" color={isPrimary ? colors.onPrimary : 'textPrimary'}>
          {title}
        </AppText>
        <AppText variant="sm" color={isPrimary ? 'rgba(255,255,255,0.78)' : 'textSecondary'}>
          {subtitle}
        </AppText>
      </View>
      <IconArrowRight size={18} color={isPrimary ? colors.onPrimary : colors.textPrimary} />
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
        <View style={styles.heroIcon}>
          <IconRoute size={34} color={colors.primaryLight} />
        </View>
        <AppText variant="xxl" weight="semibold" align="center">
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
          icon={<IconUser size={19} color={colors.onPrimary} />}
          iconBackground="rgba(255,255,255,0.15)"
          tone="primary"
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
          Déjà inscrit ? <AppText variant="sm" weight="semibold" color="primary">Se connecter</AppText>
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
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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
    borderRadius: radius.lg,
    borderWidth: 1.5,
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
