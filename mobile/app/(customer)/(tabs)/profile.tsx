// mobile/app/(customer)/(tabs)/profile.tsx
//
// v3 — Affiche l'adresse quand elle est renseignée.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconEdit,
  IconHome,
  IconLogout,
  IconMapPin,
  IconPhone,
  IconUserCircle,
  IconWorld,
} from '@tabler/icons-react-native';
import { AppText, Avatar, Badge, Card, Divider, IconButton, ScreenContainer } from '@/components/ui';
import { HoverCard } from '@/components/ui/HoverCard';
import { colors, radius, spacing } from '@/theme';
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
  const missingLocation = Boolean(profile) && !profile?.city && !profile?.country;

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Avatar initials={initials} imageUri={profile?.photoUrl} size={64} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <AppText variant="lg" weight="semibold">
              {profile ? `${profile.firstName} ${profile.lastName}` : '…'}
            </AppText>
            {user?.isPhoneVerified ? <IconCheck size={16} color={colors.successDark} /> : null}
          </View>
          <AppText variant="sm" color="textSecondary">
            Compte client
          </AppText>
          {profile?.createdAt ? (
            <AppText variant="xs" color="textMuted">
              Membre depuis {formatDateShort(profile.createdAt)}
            </AppText>
          ) : null}
        </View>
        <IconButton
          icon={<IconEdit size={18} color={colors.textPrimary} />}
          accessibilityLabel="Modifier le profil"
          onPress={() => router.push('/(customer)/edit-profile')}
        />
        <IconButton
          icon={<IconLogout size={18} color={colors.danger} />}
          accessibilityLabel="Se déconnecter"
          onPress={handleLogout}
        />
      </View>

      {missingLocation ? (
        <HoverCard style={styles.locationBanner} onPress={() => router.push('/(customer)/edit-profile')}>
          <IconMapPin size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="sm" weight="semibold">
              Complétez votre localisation
            </AppText>
            <AppText variant="xs" color="textSecondary">
              Ville et pays aident à personnaliser votre expérience.
            </AppText>
          </View>
          <IconChevronRight size={16} color={colors.textSecondary} />
        </HoverCard>
      ) : null}

      <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
        Coordonnées
      </AppText>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <IconPhone size={18} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <AppText variant="sm" color="textSecondary">
              Téléphone
            </AppText>
            <AppText variant="md" weight="medium">
              {user?.phone}
            </AppText>
          </View>
          {user?.isPhoneVerified ? (
            <Badge label="Vérifié" tone="success" icon={<IconCheck size={12} color={colors.successDark} />} />
          ) : null}
        </View>

        <Divider />

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <IconUserCircle size={18} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <AppText variant="sm" color="textSecondary">
              Email
            </AppText>
            <AppText variant="md" weight="medium">
              {user?.email ?? 'Non renseigné'}
            </AppText>
          </View>
        </View>

        <Divider />

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <IconMapPin size={18} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <AppText variant="sm" color="textSecondary">
              Ville
            </AppText>
            <AppText variant="md" weight="medium">
              {profile?.city?.name ?? 'Non renseignée'}
            </AppText>
          </View>
        </View>

        <Divider />

        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <IconWorld size={18} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <AppText variant="sm" color="textSecondary">
              Pays
            </AppText>
            <AppText variant="md" weight="medium">
              {profile?.country?.name ?? 'Non renseigné'}
            </AppText>
          </View>
        </View>

        {profile?.address ? (
          <>
            <Divider />
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <IconHome size={18} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <AppText variant="sm" color="textSecondary">
                  Adresse
                </AppText>
                <AppText variant="md" weight="medium">
                  {profile.address}
                </AppText>
              </View>
            </View>
          </>
        ) : null}

        {profile?.dateOfBirth ? (
          <>
            <Divider />
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <IconCalendar size={18} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <AppText variant="sm" color="textSecondary">
                  Date de naissance
                </AppText>
                <AppText variant="md" weight="medium">
                  {formatDateShort(profile.dateOfBirth)}
                </AppText>
              </View>
            </View>
          </>
        ) : null}
      </Card>

      <HoverCard onPress={() => router.push('/(customer)/disputes')} style={styles.row}>
        <View style={styles.rowIcon}>
          <IconAlertTriangle size={18} color={colors.primary} />
        </View>
        <AppText variant="md" weight="medium" style={styles.rowText}>
          Mes litiges
        </AppText>
        <IconChevronRight size={16} color={colors.textMuted} />
      </HoverCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  card: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
});