// mobile/app/(driver)/(tabs)/home.tsx
//
// v8 — Plus d'air entre l'en-tête (profil + cloche) et ce qui suit (bandeau
// de statut, carte véhicule ou tuiles violette/jaune) : HomeHeader est
// enveloppé dans une vue avec une marge basse, valable quel que soit le
// bloc qui vient dessous.
//
// v7 — Le badge de places du « Prochain trajet » passe par
// formatSeatsAvailability (utils/seats.ts) : « Complet » / « 2 places
// libres » au lieu de « 0/2 places », qui se lisait aussi bien « 0 libre »
// que « 0 réservée » et ne collait pas avec l'écran détail du trajet.
//
// v6 — Header refondu dans un composant isolé (HomeHeader) : avatar
// cliquable + salutation à gauche, cloche de notifications en haut à
// droite. Le bouton de déconnexion est retiré d'ici — il reste dans
// l'écran Profil. Cartes de stats refaites dans un composant isolé
// (StatCard) : cause racine du débordement = `aspectRatio: 1` du v5, qui
// figeait la hauteur (~110 px) alors que le contenu (icône + valeur +
// libellé retombant sur 3-4 lignes) était plus haut. La hauteur suit
// maintenant le contenu, libellés courts à coupure explicite, et
// l'anneau ne porte plus que le nombre de trajets (le "0%" empilé dessous
// débordait de l'anneau). Carte "Prochain trajet" affinée : trajet en
// titre, date avec icône, places en badge, chevron.
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
  IconCalendarEvent,
  IconCar,
  IconChevronRight,
  IconPackage,
  IconRoute,
  IconStarFilled,
} from '@tabler/icons-react-native';
import { AppText, Badge, Card, ProgressRing, RouteMap, ScreenContainer } from '@/components/ui';
import { HomeHeader } from '@/components/screens/HomeHeader';
import { StatCard, StatIconBadge } from '@/components/screens/StatCard';
import { TripTileIllustration } from '@/components/illustrations/TripTileIllustration';
import { ShipmentTileIllustration } from '@/components/illustrations/ShipmentTileIllustration';
import { colors, radius, spacing } from '@/theme';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { useMyVehicles } from '@/hooks/useVehicles';
import { useMyTrips } from '@/hooks/useDriverTrips';
import { useMyNotifications } from '@/hooks/useNotifications';
import { formatDateShort, formatTime } from '@/utils/date';
import { getTripMilestoneProgress } from '@/utils/milestones';
import { formatSeatsAvailability } from '@/utils/seats';

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

  const nextTrip = tripsPage?.data.find((trip) => UPCOMING_STATUSES.has(trip.status));
  const unreadCount = notificationsPage?.data.filter((n) => !n.readAt).length ?? 0;
  const tripMilestone = getTripMilestoneProgress(profile?.completedTripsCount ?? 0);

  const completedTrips = profile?.completedTripsCount ?? 0;
  const ratingsCount = profile?.ratingsCount ?? 0;
  const vehiclesCount = vehicles?.length ?? 0;
  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '…';

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <HomeHeader
          firstName={profile?.firstName}
          initials={initials}
          photoUri={profile?.photoUrl}
          isVerified={profile?.status === 'VALIDATED'}
          unreadCount={unreadCount}
          onPressAvatar={() => router.navigate('/(driver)/(tabs)/profile')}
          onPressNotifications={() => router.push('/(driver)/notifications')}
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
          <AppText variant="md" weight="semibold" style={styles.sectionTitle}>
            Prochain trajet
          </AppText>
          <Card onPress={() => router.push(`/(driver)/trip/${nextTrip.id}`)} style={styles.tripCard}>
            <View style={styles.tripTop}>
              <AppText variant="md" weight="semibold" style={styles.tripRoute} numberOfLines={1}>
                {nextTrip.originCity.name} → {nextTrip.destinationCity.name}
              </AppText>
              <IconChevronRight size={18} color={colors.textMuted} />
            </View>
            <View style={styles.tripBottom}>
              <View style={styles.tripWhen}>
                <IconCalendarEvent size={16} color={colors.textSecondary} />
                <AppText variant="sm" color="textSecondary">
                  {formatDateShort(nextTrip.departureAt)} à {formatTime(nextTrip.departureAt)}
                </AppText>
              </View>
              <Badge
                label={formatSeatsAvailability(nextTrip.availableSeats)}
                tone={nextTrip.availableSeats > 0 ? 'primary' : 'success'}
              />
            </View>
          </Card>
        </>
      ) : null}

      <AppText variant="md" weight="semibold" style={styles.sectionTitle}>
        Vos statistiques
      </AppText>
      <View style={styles.statsRow}>
        <StatCard
          visual={
            <StatIconBadge
              background={colors.accentLight}
              icon={<IconStarFilled size={18} color={colors.accent} />}
            />
          }
          value={profile?.averageRating ? profile.averageRating.toFixed(1) : '—'}
          label={`Note moyenne\n${ratingsCount} avis`}
        />
        <StatCard
          visual={
            <ProgressRing progress={tripMilestone.progress} size={56} strokeWidth={5}>
              <AppText variant="lg" weight="bold">
                {completedTrips}
              </AppText>
            </ProgressRing>
          }
          label={'Trajets\nterminés'}
        />
        <StatCard
          visual={
            <StatIconBadge
              background={colors.primaryLight}
              icon={<IconCar size={18} color={colors.primary} />}
            />
          }
          value={String(vehiclesCount)}
          label={vehiclesCount > 1 ? 'Véhicules\nenregistrés' : 'Véhicule\nenregistré'}
        />
      </View>

      <View style={styles.routeSectionHeader}>
        <IconRoute size={16} color={colors.textSecondary} />
        <AppText variant="md" weight="semibold">
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
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  tripTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tripRoute: {
    flex: 1,
  },
  tripBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  tripWhen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs + 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
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