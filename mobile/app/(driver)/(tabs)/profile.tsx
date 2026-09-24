// mobile/app/(driver)/(tabs)/profile.tsx
//
// v8 — Même refonte que côté client : cet onglet affiche désormais un menu
// plutôt que directement la fiche de profil (déménagée sur
// /(driver)/my-profile, ouverte depuis « Mon profil »). Pas de code promo
// ici (le chauffeur ne paie aucune prestation) ni de cartes bancaires (le
// portefeuille chauffeur n'a rien à voir avec un moyen de paiement client)
// — mais le parrainage y est, puisqu'un chauffeur peut aussi parrainer et
// recevoir la récompense sur son portefeuille.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconChevronRight,
  IconCompass,
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
import { useDriverProfile } from '@/hooks/useDriverProfile';

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

export default function DriverMenuScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { data: profile } = useDriverProfile();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/onboarding');
  }

  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '?';

  return (
    <ScreenContainer scroll>
      <Pressable
        onPress={() => router.push('/(driver)/my-profile')}
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
          onPress={() => router.push('/(driver)/my-profile')}
        />
        <MenuRow
          icon={<IconMessageStar size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Mes avis"
          onPress={() => router.push('/(driver)/my-reviews')}
        />
        <MenuRow
          icon={<IconAlertTriangle size={18} color={colors.dangerDark} />}
          iconBackground={colors.dangerLight}
          label="Mes litiges"
          onPress={() => router.push('/(driver)/disputes')}
          isLast
        />
      </OceanSection>

      <OceanSection icon={<IconTicket size={17} color={OCEAN.base} />} title="Promotions">
        <MenuRow
          icon={<IconTicket size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Bons plans"
          onPress={() => router.push('/(driver)/deals')}
        />
        <MenuRow
          icon={<IconGift size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Parrainez des amis"
          onPress={() => router.push('/(driver)/referral')}
          isLast
        />
      </OceanSection>

      <OceanSection icon={<IconCompass size={17} color={OCEAN.base} />} title="Informations">
        <MenuRow
          icon={<IconSpeakerphone size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Actualités"
          onPress={() => router.push('/(driver)/news')}
        />
        <MenuRow
          icon={<IconCompass size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Comment ça marche ?"
          onPress={() => router.push('/(driver)/how-it-works')}
          isLast
        />
      </OceanSection>

      <OceanSection icon={<IconHelpCircle size={17} color={OCEAN.base} />} title="Aide">
        <MenuRow
          icon={<IconHelpCircle size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Obtenir de l'aide"
          onPress={() => router.push('/(driver)/help')}
        />
        <MenuRow
          icon={<IconShieldLock size={18} color={OCEAN.base} />}
          iconBackground={OCEAN.mist}
          label="Protection des données"
          onPress={() => router.push('/(driver)/privacy')}
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