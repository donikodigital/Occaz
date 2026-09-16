// mobile/app/(driver)/(tabs)/home.tsx
//
// v2 — "Prochain trajet" et les cartes de stats passent en HoverCard
// (échelle + ombre au survol sur desktop/web, aucun effet sur mobile
// tactile). Ajout d'une 3e carte de stat "Véhicules" (réutilise
// useMyVehicles, déjà chargé dans ce fichier pour la tuile de config) —
// complète naturellement la ligne à 3 cartes sans nouvel appel réseau.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconBell,
  IconCar,
  IconLogout,
  IconPackage,
  IconPlus,
  IconShieldCheck,
  IconStarFilled,
} from '@tabler/icons-react-native';
import { AppText, Badge, Card, IconButton, ScreenContainer } from '@/components/ui';
import { HoverCard } from '@/components/ui/HoverCard';
import { colors, radius, spacing } from '@/theme';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { useMyVehicles } from '@/hooks/useVehicles';
import { useMyTrips } from '@/hooks/useDriverTrips';
import { useAuthStore } from '@/stores/authStore';
import { formatDateShort, formatTime } from '@/utils/date';

const UPCOMING_STATUSES = new Set(['PUBLISHED', 'DRIVER_ARRIVED', 'PASSENGER_PICKED_UP', 'IN_PROGRESS']);

export default function DriverHomeScreen() {
  const { data: profile } = useDriverProfile();
  const { data: vehicles } = useMyVehicles();
  const { data: tripsPage } = useMyTrips();
  const logout = useAuthStore((state) => state.logout);

  const nextTrip = tripsPage?.data.find((trip) => UPCOMING_STATUSES.has(trip.status));

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/onboarding');
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <View>
          <AppText variant="sm" color="textSecondary">
            Bonjour
          </AppText>
          <AppText variant="xl" weight="semibold">
            {profile?.firstName ?? '…'}
          </AppText>
        </View>
        <IconButton
          icon={<IconBell size={18} color={colors.textPrimary} />}
          accessibilityLabel="Notifications"
          onPress={() => router.push('/(driver)/notifications')}
        />
        <IconButton
          icon={<IconLogout size={18} color={colors.danger} />}
          accessibilityLabel="Se déconnecter"
          onPress={handleLogout}
        />
      </View>

      {profile && profile.status !== 'VALIDATED' ? (
        <Card style={styles.statusBanner}>
          <IconAlertTriangle size={18} color={colors.accentDark} />
          <AppText variant="sm" color={colors.accentDark} style={{ flex: 1 }}>
            {profile.status === 'PENDING'
              ? 'Votre profil est en cours de vérification par notre équipe.'
              : profile.status === 'SUSPENDED'
                ? 'Votre compte est suspendu — contactez le support.'
                : 'Votre dossier a été rejeté — contactez le support pour en savoir plus.'}
          </AppText>
        </Card>
      ) : null}

      {vehicles && vehicles.length === 0 ? (
        <Pressable onPress={() => router.push('/(driver)/vehicle-new')} style={styles.setupCard}>
          <IconCar size={20} color={colors.primary} />
          <AppText variant="sm" weight="medium" style={{ flex: 1 }}>
            Ajoutez un véhicule pour commencer à proposer des trajets
          </AppText>
        </Pressable>
      ) : (
        <View style={styles.tileRow}>
          <Pressable
            onPress={() => router.push('/(driver)/trip-new')}
            style={[styles.tile, { backgroundColor: colors.primary }]}
          >
            <IconPlus size={22} color={colors.onPrimary} />
            <AppText variant="base" weight="semibold" color={colors.onPrimary} style={styles.tileLabel}>
              Créer{'\n'}un trajet
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(driver)/shipment-available')}
            style={[styles.tile, { backgroundColor: colors.accent }]}
          >
            <IconPackage size={22} color={colors.onAccent} />
            <AppText variant="base" weight="semibold" color={colors.onAccent} style={styles.tileLabel}>
              Envois{'\n'}disponibles
            </AppText>
          </Pressable>
        </View>
      )}

      {nextTrip ? (
        <>
          <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
            Prochain trajet
          </AppText>
          <HoverCard onPress={() => router.push(`/(driver)/trip/${nextTrip.id}`)} style={styles.tripCard}>
            <AppText variant="sm" color="textSecondary">
              {nextTrip.originCity.name} → {nextTrip.destinationCity.name}
            </AppText>
            <AppText variant="base" weight="semibold">
              {formatDateShort(nextTrip.departureAt)} à {formatTime(nextTrip.departureAt)}
            </AppText>
            <View style={styles.tripMeta}>
              <Badge label={`${nextTrip.availableSeats}/${nextTrip.totalSeats} places`} tone="primary" />
            </View>
          </HoverCard>
        </>
      ) : null}

      <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
        Statistiques
      </AppText>
      <View style={styles.statsRow}>
        <HoverCard style={styles.statCard}>
          <IconStarFilled size={16} color={colors.accent} />
          <AppText variant="lg" weight="semibold">
            {profile?.averageRating ? profile.averageRating.toFixed(1) : '—'}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Note ({profile?.ratingsCount ?? 0})
          </AppText>
        </HoverCard>
        <HoverCard onPress={() => router.push('/(driver)/(tabs)/trips')} style={styles.statCard}>
          <IconShieldCheck size={16} color={colors.successDark} />
          <AppText variant="lg" weight="semibold">
            {profile?.completedTripsCount ?? 0}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Trajets terminés
          </AppText>
        </HoverCard>
        <HoverCard onPress={() => router.push('/(driver)/(tabs)/profile')} style={styles.statCard}>
          <IconCar size={16} color={colors.primary} />
          <AppText variant="lg" weight="semibold">
            {vehicles?.length ?? 0}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Véhicule{(vehicles?.length ?? 0) > 1 ? 's' : ''}
          </AppText>
        </HoverCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentLight,
    borderColor: colors.accentLight,
    marginBottom: spacing.md,
  },
  setupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    marginBottom: spacing.lg,
  },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tileLabel: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  tripCard: {
    gap: 4,
    marginBottom: spacing.lg,
  },
  tripMeta: {
    flexDirection: 'row',
    marginTop: spacing.xxs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
});