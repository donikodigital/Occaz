// mobile/app/(driver)/(tabs)/profile.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCar, IconCheck, IconEdit, IconLogout, IconPhone, IconPlus } from '@tabler/icons-react-native';
import { AppText, Avatar, Badge, Card, Divider, IconButton, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useAuthStore } from '@/stores/authStore';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { useMyVehicles } from '@/hooks/useVehicles';

export default function DriverProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { data: profile } = useDriverProfile();
  const { data: vehicles } = useMyVehicles();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/onboarding');
  }

  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '?';

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Avatar initials={initials} imageUri={profile?.photoUrl} size={56} backgroundColor={colors.success} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <AppText variant="lg" weight="semibold">
              {profile ? `${profile.firstName} ${profile.lastName}` : '…'}
            </AppText>
            {profile?.isVerifiedBadge ? (
              <IconCheck size={16} color={colors.successDark} />
            ) : null}
          </View>
          <AppText variant="sm" color="textSecondary">
            Compte chauffeur
          </AppText>
        </View>
        <IconButton
          icon={<IconEdit size={18} color={colors.textPrimary} />}
          accessibilityLabel="Modifier le profil"
          onPress={() => router.push('/(driver)/edit-profile')}
        />
        <IconButton
          icon={<IconLogout size={18} color={colors.danger} />}
          accessibilityLabel="Se déconnecter"
          onPress={handleLogout}
        />
      </View>

      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <IconPhone size={18} color={colors.success} />
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
      </Card>

      <View style={styles.sectionHeader}>
        <AppText variant="base" weight="semibold">
          Mes véhicules
        </AppText>
        <IconButton
          icon={<IconPlus size={16} color={colors.textPrimary} />}
          accessibilityLabel="Ajouter un véhicule"
          onPress={() => router.push('/(driver)/vehicle-new')}
        />
      </View>

      <View style={styles.vehicleList}>
        {(vehicles ?? []).map((vehicle) => (
          <Card key={vehicle.id} style={styles.vehicleRow}>
            <View style={styles.rowIcon}>
              <IconCar size={18} color={colors.success} />
            </View>
            <View style={styles.rowText}>
              <AppText variant="sm" weight="semibold">
                {vehicle.brand} {vehicle.model}
              </AppText>
              <AppText variant="xs" color="textSecondary">
                {vehicle.plateNumber} · {vehicle.totalSeats} places
              </AppText>
            </View>
            <Badge
              label={vehicle.verificationStatus === 'VERIFIED' ? 'Vérifié' : 'En attente'}
              tone={vehicle.verificationStatus === 'VERIFIED' ? 'success' : 'neutral'}
            />
          </Card>
        ))}
        {vehicles && vehicles.length === 0 ? (
          <AppText variant="sm" color="textMuted">
            Aucun véhicule ajouté.
          </AppText>
        ) : null}
      </View>

      <Divider />

      <AppText variant="sm" color="textMuted" align="center" style={styles.footnote}>
        Envois, portefeuille, litiges et messagerie arrivent avec les prochains lots.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  vehicleList: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  footnote: {
    marginTop: spacing.md,
  },
});
