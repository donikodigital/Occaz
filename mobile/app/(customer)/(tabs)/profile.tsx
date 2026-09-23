// mobile/app/(customer)/(tabs)/profile.tsx
// v7 — Sections Promotions (codes promo, parrainage, bons plans) et Actualités/Cartes bancaires ajoutées, maintenant que ces écrans existent.
// v6 — Refonte : cet onglet affiche désormais un menu (à la CityGo) plutôt
// que directement la fiche de profil détaillée — celle-ci a déménagé sur
// /(customer)/my-profile, ouverte depuis « Mon profil » ci-dessous. Un
// petit bandeau (avatar + nom) sert de raccourci en plus de l'entrée de
// la liste, avant les sections Espace personnel / Informations / Aide,
// dans le langage visuel Ocean (OceanSection, mêmes pastilles et lignes
// que le reste de l'app — rien de repris de CityGo, seul le classement
// des rubriques s'en inspire).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconChevronRight,
  IconCompass,
  IconCreditCard,
  IconDiscount2,
  IconGift,
  IconHelpCircle,
  IconLogout,
  IconMessageStar,
  IconShieldLock,
  IconSpeakerphone,
  IconTicket,
  IconUser,
} from '@tabler/icons-react-native';
import { AppText, Avatar, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanHeroCard, OceanSection } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAuthStore } from '@/stores/authStore';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';

interface MenuRowProps {
  icon: React.ReactNode;
  iconBackground: string;
  label: string;
  onPress: () => void;
  isLast?: boolean;
}

function MenuRow({ icon, iconBackground, label, onPress, isLast }: MenuRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: iconBackground }]}>{icon}</View>
      <AppText variant="sm" weight="semibold" style={styles.rowLabel}>
        {label}
      </AppText>
      <IconChevronRight size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export default function CustomerMenuScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { data: profile } = useCustomerProfile();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/onboarding');
  }

  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '?';

  return (
    <ScreenContainer scroll>
      <Pressable
        onPress={() => router.push('/(customer)/my-profile')}
        accessibilityRole="button"
        accessibilityLabel="Voir mon profil"
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <OceanHeroCard style={styles.hero}>
          <Avatar initials={initials} imageUri={profile?.photoUrl} size={52} />
          <View style={styles.heroText}>
            <AppText variant="md" weight="bold" color={OCEAN.onDark} numberOfLines={1}>
              {profile ? `${profile.firstName} ${profile.lastName}` : user?.phone}
            </AppText>
            <AppText variant="xs" color={OCEAN.sky}>
              Voir mon profil
            </AppText>
          </View>
          <IconChevronRight size={18} color={OCEAN.sky} />
        </OceanHeroCard>
      </Pressable>

      <OceanSection icon={<IconUser size={17} color={OCEAN.base} />} title="Espace personnel">
        <MenuRow
          icon={<IconUser size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Mon profil"
          onPress={() => router.push('/(customer)/my-profile')}
        />
        <MenuRow
          icon={<IconMessageStar size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Mes avis"
          onPress={() => router.push('/(customer)/my-reviews')}
        />
        <MenuRow
          icon={<IconAlertTriangle size={18} color={colors.dangerDark} />}
          iconBackground={colors.dangerLight}
          label="Mes litiges"
          onPress={() => router.push('/(customer)/disputes')}
        />
        <MenuRow
          icon={<IconCreditCard size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Mes cartes bancaires"
          onPress={() => router.push('/(customer)/saved-cards')}
          isLast
        />
      </OceanSection>

      <OceanSection icon={<IconDiscount2 size={17} color={OCEAN.base} />} title="Promotions">
        <MenuRow
          icon={<IconDiscount2 size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Saisir code promo"
          onPress={() => router.push('/(customer)/promo-code')}
        />
        <MenuRow
          icon={<IconGift size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Parrainez des amis"
          onPress={() => router.push('/(customer)/referral')}
        />
        <MenuRow
          icon={<IconTicket size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Bons plans"
          onPress={() => router.push('/(customer)/deals')}
          isLast
        />
      </OceanSection>

      <OceanSection icon={<IconCompass size={17} color={OCEAN.base} />} title="Informations">
        <MenuRow
          icon={<IconSpeakerphone size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Actualités"
          onPress={() => router.push('/(customer)/news')}
        />
        <MenuRow
          icon={<IconCompass size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Comment ça marche ?"
          onPress={() => router.push('/(customer)/how-it-works')}
          isLast
        />
      </OceanSection>

      <OceanSection icon={<IconHelpCircle size={17} color={OCEAN.base} />} title="Aide">
        <MenuRow
          icon={<IconHelpCircle size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Obtenir de l'aide"
          onPress={() => router.push('/(customer)/help')}
        />
        <MenuRow
          icon={<IconShieldLock size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Protection des données"
          onPress={() => router.push('/(customer)/privacy')}
          isLast
        />
      </OceanSection>

      <OceanCard style={styles.logoutCard}>
        <OceanButton
          label="Se déconnecter"
          variant="outline"
          icon={<IconLogout size={17} color={OCEAN.base} />}
          onPress={handleLogout}
        />
      </OceanCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  heroText: {
    flex: 1,
    gap: 1,
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
  logoutCard: {
    padding: spacing.sm,
    marginBottom: spacing.lg,
  },
});