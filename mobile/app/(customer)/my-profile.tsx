// mobile/app/(customer)/my-profile.tsx
// [22/09/2026] v6 — Déplacé depuis l'onglet Profil (devenu un menu, voir
// (tabs)/profile.tsx) : cet écran, ouvert via « Mon profil », ne montre
// plus que la fiche détaillée elle-même. « Mes litiges » et la
// déconnexion ont suivi le même mouvement, vers le menu — pour ne pas les
// dupliquer à deux endroits.
//
// v5 — badge caméra sur l'avatar, ouvre la modification du profil (photo modifiable, comme côté chauffeur).
//
// v4 — Profil client construit sur le profil chauffeur : bandeau sombre aux
// reflets bleus avec la photo, la pastille de statut et le nom (nom de
// famille en doré), bouton « Modifier mon profil » pleine largeur, puis des
// sections à en-tête soulignée (Identité & contact, Localisation).

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconCamera,
  IconCheck,
  IconChevronRight,
  IconEdit,
  IconMapPin,
  IconShieldCheck,
  IconUser,
  IconUserCircle,
} from '@tabler/icons-react-native';
import { AppText, Avatar, ScreenContainer } from '@/components/ui';
import {
  OceanButton,
  OceanField,
  OceanHeroCard,
  OceanPill,
  OceanScreenHeader,
  OceanSection,
} from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAuthStore } from '@/stores/authStore';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { formatDateShort } from '@/utils/date';

export default function MyProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const { data: profile } = useCustomerProfile();

  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '?';
  const isVerified = Boolean(user?.isPhoneVerified);
  const missingLocation = Boolean(profile) && !profile?.city && !profile?.country;

  return (
    <ScreenContainer scroll>
      <OceanScreenHeader title="Mon profil" onBack={() => router.back()} />

      <OceanHeroCard style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.avatarFrame}>
            <Avatar initials={initials} imageUri={profile?.photoUrl} size={64} />
            <Pressable
              onPress={() => router.push('/(customer)/edit-profile')}
              accessibilityRole="button"
              accessibilityLabel="Modifier la photo"
              style={({ pressed }) => [styles.cameraBadge, pressed && styles.pressed]}
            >
              <IconCamera size={13} color={OCEAN.deep} />
            </Pressable>
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
    position: 'relative',
    padding: 3,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: OCEAN.sky,
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: OCEAN.sky,
    borderWidth: 2,
    borderColor: OCEAN.deep,
    alignItems: 'center',
    justifyContent: 'center',
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
});