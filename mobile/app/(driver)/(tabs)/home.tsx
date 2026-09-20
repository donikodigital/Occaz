// mobile/app/(driver)/(tabs)/home.tsx
//
// v5 — statCard passe en carré (aspectRatio: 1), toujours 3 par ligne
// (déjà garanti par statsRow en row sans wrap, inchangé). Les 2 grandes
// tuiles reçoivent un flourish illustré en haut à droite
// (TripTileIllustration / ShipmentTileIllustration, fichiers isolés) au
// lieu d'un fond photo — évite toute dépendance réseau à l'exécution et
// tout souci de licence, voir échange avec Doniko.

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
  IconRoute,
  IconStarFilled,
} from '@tabler/icons-react-native';
import { AppText, Badge, Card, IconButton, ProgressRing, RouteMap, ScreenContainer } from '@/components/ui';
import { TripTileIllustration } from '@/components/illustrations/TripTileIllustration';
import { ShipmentTileIllustration } from '@/components/illustrations/ShipmentTileIllustration';
import { colors, radius, spacing } from '@/theme';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { useMyVehicles } from '@/hooks/useVehicles';
import { useMyTrips } from '@/hooks/useDriverTrips';
import { useMyNotifications } from '@/hooks/useNotifications';
import { useAuthStore } from '@/stores/authStore';
import { formatDateShort, formatTime } from '@/utils/date';
import { getTripMilestoneProgress } from '@/utils/milestones';

const UPCOMING_STATUSES = new Set(['PUBLISHED', 'DRIVER_ARRIVED', 'PASSENGER_PICKED_UP', 'IN_PROGRESS']);

// Coordonnées fixes — raccourci décoratif, pas une recherche de trajet
// réelle. Mêmes valeurs que CONAKRY_CENTER dans RouteMap.web.tsx pour
// l'origine.
const CONAKRY = { latitude: 9.6412, longitude: -13.6773, label: 'Conakry' };
const DAKAR = { latitude: 14.7167, longitude: -17.4677, label: 'Dakar' };

export default function DriverHomeScreen() {
  const { data: profile } = useDriverProfile();
  const { data: vehicles } = useMyVehicles();
  const { data: tripsPage } = useMyTrips();
  // Pas d'endpoint compteur dédié — approximation à partir de la première
  // page de notifications (30 les plus récentes). Sous-compte si plus de
  // 30 non lues d'un coup, cas limite acceptable pour un badge d'accueil.
  const { data: notificationsPage } = useMyNotifications(1);
  const logout = useAuthStore((state) => state.logout);

  const nextTrip = tripsPage?.data.find((trip) => UPCOMING_STATUSES.has(trip.status));
  const unreadCount = notificationsPage?.data.filter((n) => !n.readAt).length ?? 0;
  const tripMilestone = getTripMilestoneProgress(profile?.completedTripsCount ?? 0);

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
        <View style={styles.bellWrapper}>
          <IconButton
            icon={<IconBell size={18} color={colors.textPrimary} />}
            accessibilityLabel="Notifications"
            onPress={() => router.push('/(driver)/notifications')}
          />
          {unreadCount > 0 ? (
            <View style={styles.notificationBadge}>
              <AppText variant="xs" weight="semibold" color="#fff" style={styles.notificationBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </AppText>
            </View>
          ) : null}
        </View>
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
            <View style={styles.tileIllustration}>
              <TripTileIllustration />
            </View>
            <IconCar size={36} color={colors.onPrimary} style={styles.tileIcon} />
            <AppText variant="base" weight="semibold" color={colors.onPrimary}>
              Créer un trajet
            </AppText>
            <AppText variant="xs" color={colors.onPrimary} style={styles.tileSubtitle}>
              Partager votre route
            </AppText>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(driver)/shipment-available')}
            style={[styles.tile, { backgroundColor: colors.accent }]}
          >
            <View style={styles.tileIllustration}>
              <ShipmentTileIllustration />
            </View>
            <IconPackage size={36} color={colors.onAccent} style={styles.tileIcon} />
            <AppText variant="base" weight="semibold" color={colors.onAccent}>
              Envois disponibles
            </AppText>
            <AppText variant="xs" color={colors.onAccent} style={styles.tileSubtitle}>
              Livrer des colis
            </AppText>
          </Pressable>
        </View>
      )}

      {nextTrip ? (
        <>
          <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
            Prochain trajet
          </AppText>
          <Card onPress={() => router.push(`/(driver)/trip/${nextTrip.id}`)} style={styles.tripCard}>
            <AppText variant="sm" color="textSecondary">
              {nextTrip.originCity.name} → {nextTrip.destinationCity.name}
            </AppText>
            <AppText variant="base" weight="semibold">
              {formatDateShort(nextTrip.departureAt)} à {formatTime(nextTrip.departureAt)}
            </AppText>
            <View style={styles.tripMeta}>
              <Badge label={`${nextTrip.availableSeats}/${nextTrip.totalSeats} places`} tone="primary" />
            </View>
          </Card>
        </>
      ) : null}

      <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
        Vos statistiques
      </AppText>
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <IconStarFilled size={18} color={colors.accent} />
          <AppText variant="lg" weight="semibold">
            {profile?.averageRating ? profile.averageRating.toFixed(1) : '—'}
          </AppText>
          <AppText variant="xs" color="textSecondary" align="center">
            Note globale{'\n'}sur {profile?.ratingsCount ?? 0} trajets
          </AppText>
        </Card>

        <Card style={styles.statCard}>
          <ProgressRing progress={tripMilestone.progress} size={48} strokeWidth={4}>
            <AppText variant="xs" weight="semibold">
              {profile?.completedTripsCount ?? 0}
            </AppText>
            <AppText variant="xs" color="textSecondary" style={styles.ringPercent}>
              {Math.round(tripMilestone.progress * 100)}%
            </AppText>
          </ProgressRing>
          <AppText variant="xs" color="textSecondary" align="center" style={{ marginTop: spacing.xxs }}>
            Trajets terminés{'\n'}depuis votre inscription
          </AppText>
        </Card>

        <Card style={styles.statCard}>
          <IconCar size={18} color={colors.primary} />
          <AppText variant="lg" weight="semibold">
            {vehicles?.length ?? 0}
          </AppText>
          <AppText variant="xs" color="textSecondary" align="center">
            Véhicule{(vehicles?.length ?? 0) > 1 ? 's' : ''}{'\n'}enregistré{(vehicles?.length ?? 0) > 1 ? 's' : ''}
          </AppText>
        </Card>
      </View>

      <View style={styles.routeSectionHeader}>
        <IconRoute size={16} color={colors.textSecondary} />
        <AppText variant="base" weight="semibold">
          Itinéraire Conakry → Dakar
        </AppText>
      </View>
      <Card style={styles.routeCard}>
        <RouteMap origin={CONAKRY} destination={DAKAR} height={180} />
      </Card>
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
  bellWrapper: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  notificationBadgeText: {
    fontSize: 10,
    lineHeight: 12,
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
    minHeight: 140,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  tileIllustration: {
    position: 'absolute',
    top: -14,
    right: -18,
    transform: [{ rotate: '-6deg' }],
  },
  tileIcon: {
    marginBottom: spacing.md,
  },
  tileSubtitle: {
    opacity: 0.85,
    marginTop: 2,
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
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
  },
  ringPercent: {
    fontSize: 9,
  },
  routeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  routeCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
});