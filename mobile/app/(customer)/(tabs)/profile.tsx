// mobile/app/(customer)/(tabs)/profile.tsx
//
// v4 — Profil client construit sur le profil chauffeur : bandeau sombre aux
// reflets bleus avec la photo, la pastille de statut et le nom (nom de
// famille en doré), bouton « Modifier mon profil » pleine largeur, puis des
// sections à en-tête soulignée (Identité & contact, Localisation) dont les
// champs sont des boîtes claires. « Mes litiges » et la déconnexion
// terminent la page. Seul le contenu diffère du compte chauffeur.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronRight,
  IconEdit,
  IconLogout,
  IconMapPin,
  IconShieldCheck,
  IconUser,
  IconUserCircle,
} from '@tabler/icons-react-native';
import { AppText, Avatar, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanField, OceanHeroCard, OceanPill, OceanSection } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAuthStore } from '@/stores/authStore';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { formatDateShort } from '@/utils/date';

export default function CustomerProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { data: profile } = useCustomerProfile();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/onboarding');
  }

  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '?';
  const isVerified = Boolean(user?.isPhoneVerified);
  const missingLocation = Boolean(profile) && !profile?.city && !profile?.country;

  return (
    <ScreenContainer scroll>
      <OceanHeroCard style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.avatarFrame}>
            <Avatar initials={initials} imageUri={profile?.photoUrl} size={64} />
          </View>
          <View style={styles.heroText}>
            <View style={styles.statusPill}>
              {isVerified ? (
                <IconShieldCheck size={13} color={OCEAN.onDark} />
              ) : (
                <IconUser size={13} color={OCEAN.onDark} />
              )}
              <AppText variant="xs" weight="bold" color={OCEAN.onDark} style={styles.statusText}>
                {isVerified ? 'CLIENT VÉRIFIÉ' : 'COMPTE CLIENT'}
              </AppText>
            </View>
            <AppText variant="lg" weight="bold" color={OCEAN.onDark} numberOfLines={2}>
              {profile ? `${profile.firstName} ` : '…'}
              {profile ? <AppText variant="lg" weight="bold" color={OCEAN.gold}>{profile.lastName}</AppText> : null}
            </AppText>
            {profile?.createdAt ? (
              <AppText variant="xs" color={OCEAN.sky}>
                Membre depuis {formatDateShort(profile.createdAt)}
              </AppText>
            ) : null}
          </View>
        </View>
      </OceanHeroCard>

      <OceanButton
        label="Modifier mon profil"
        icon={<IconEdit size={17} color={OCEAN.onDark} />}
        onPress={() => router.push('/(customer)/edit-profile')}
        style={styles.editButton}
      />

      {missingLocation ? (
        <Pressable
          onPress={() => router.push('/(customer)/edit-profile')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        >
          <IconMapPin size={18} color={OCEAN.goldInk} />
          <View style={styles.bannerText}>
            <AppText variant="sm" weight="semibold" color={OCEAN.goldInk}>
              Complétez votre localisation
            </AppText>
            <AppText variant="xs" color={OCEAN.goldInk}>
              Ville et pays aident à personnaliser votre expérience.
            </AppText>
          </View>
          <IconChevronRight size={16} color={OCEAN.goldInk} />
        </Pressable>
      ) : null}

      <OceanSection icon={<IconUserCircle size={17} color={OCEAN.base} />} title="Identité & contact">
        <View style={styles.twoColumns}>
          <OceanField label="Prénom" value={profile?.firstName ?? '—'} style={styles.column} />
          <OceanField label="Nom" value={profile?.lastName ?? '—'} style={styles.column} />
        </View>
        <OceanField
          label="Téléphone"
          value={user?.phone ?? '—'}
          badge={
            isVerified ? (
              <OceanPill label="Vérifié" tone="success" icon={<IconCheck size={11} color={colors.successDark} />} />
            ) : undefined
          }
        />
        <OceanField label="Email" value={user?.email ?? 'Non renseigné'} />
        {profile?.dateOfBirth ? <OceanField label="Date de naissance" value={formatDateShort(profile.dateOfBirth)} /> : null}
      </OceanSection>

      <OceanSection icon={<IconMapPin size={17} color={OCEAN.base} />} title="Localisation">
        <View style={styles.twoColumns}>
          <OceanField label="Pays" value={profile?.country?.name ?? 'Non renseigné'} style={styles.column} />
          <OceanField label="Ville" value={profile?.city?.name ?? 'Non renseignée'} style={styles.column} />
        </View>
        {profile?.address ? <OceanField label="Adresse" value={profile.address} /> : null}
      </OceanSection>

      <OceanCard onPress={() => router.push('/(customer)/disputes')} style={styles.linkCard} accessibilityLabel="Mes litiges">
        <View style={styles.linkIcon}>
          <IconAlertTriangle size={18} color={OCEAN.base} />
        </View>
        <AppText variant="md" weight="semibold" style={styles.linkLabel}>
          Mes litiges
        </AppText>
        <IconChevronRight size={16} color={colors.textMuted} />
      </OceanCard>

      <OceanButton
        label="Se déconnecter"
        variant="outline"
        icon={<IconLogout size={17} color={OCEAN.base} />}
        onPress={handleLogout}
        style={styles.logout}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  hero: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarFrame: {
    padding: 3,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: OCEAN.sky,
  },
  heroText: {
    flex: 1,
    gap: 5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusText: {
    letterSpacing: 0.8,
  },
  editButton: {
    marginBottom: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: OCEAN.goldSoft,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  column: {
    flex: 1,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: {
    flex: 1,
  },
  logout: {
    marginBottom: spacing.lg,
  },
});