// mobile/app/(driver)/trip/[id].tsx
//
// v4 — Corrige un vrai blocage : un trajet DRIVER_ARRIVED sans aucun
// passager (0 réservation) affichait « Demandez le code de chaque
// passager » — un texte qui n'a pas de sens sans passager — et le
// bouton « Annuler le trajet » disparaissait à cette étape (il n'était
// visible que pour DRAFT/PUBLISHED). Le chauffeur n'avait alors plus
// aucun moyen d'avancer ni d'annuler. La carte d'étape explique
// maintenant honnêtement la situation, et le bouton d'annulation reste
// disponible jusqu'à DRIVER_ARRIVED inclus (pas au-delà : une fois un
// passager pris en charge, annuler d'un simple bouton n'est plus
// approprié — ça relève d'un signalement, pas d'une annulation propre).
//
// v3 — Habillage bleu océan, comme l'espace client : en-tête OceanScreenHeader,
// billet dont le bandeau par défaut passe du indigo au bleu profond (OCEAN.deep),
// sections « Passagers » et « Détails » en OceanSection (même en-tête souligné
// que le profil et les envois), boutons et pastilles Ocean. Logique métier et
// structure du billet (coupon détachable, pastilles de sièges) inchangées.

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconArrowLeft,
  IconCar,
  IconCircleCheck,
  IconFlag,
  IconInfoCircle,
  IconLuggage,
  IconMessageCircle,
  IconNotes,
  IconPackage,
  IconRoute,
  IconUsers,
} from '@tabler/icons-react-native';
import { AppText, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanCard, OceanPill, OceanScreenHeader, OceanSection, type OceanPillTone } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useTrip } from '@/hooks/useTripSearch';
import { useTripPositionBroadcast } from '@/hooks/useTripPositionBroadcast';
import {
  useCancelTrip,
  useCompleteTrip,
  useMarkDriverArrived,
  useMarkTripArrived,
  usePublishTrip,
  useStartTrip,
  useTripBookings,
} from '@/hooks/useDriverTrips';
import {
  useRequestDropoffOtp,
  useRequestPickupOtp,
  useVerifyDropoffOtp,
  useVerifyPickupOtp,
} from '@/hooks/useBookings';
import { useGetOrCreateConversationForBooking } from '@/hooks/useConversations';
import { formatMoney } from '@/utils/money';
import { formatSeatsAvailability } from '@/utils/seats';
import { formatDateLong, formatTime } from '@/utils/date';
import { DRIVER_BOOKING_STATUS_LABELS, TRIP_STATUS_LABELS } from '@/utils/tripStatusLabels';
import { ApiError } from '@/services/api/ApiError';
import type { Booking } from '@/types/bookings.types';
import type { TripStatus } from '@/types/trips.types';

type BookingPhase = 'pickup' | 'dropoff' | 'none';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

const HERO_MUTED = OCEAN.sky;
const HERO_SOFT = 'rgba(255,255,255,0.18)';
const MAX_SEAT_DOTS = 10;

const STATUS_PILL_TONE: Record<TripStatus, OceanPillTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'ocean',
  BOOKING_PENDING: 'ocean',
  CONFIRMED: 'ocean',
  DRIVER_ARRIVED: 'ocean',
  PASSENGER_PICKED_UP: 'ocean',
  IN_PROGRESS: 'ocean',
  ARRIVED: 'ocean',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  DISPUTED: 'danger',
  REFUNDED: 'neutral',
};

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function formatKg(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** La couleur du bandeau raconte l'état du trajet au premier coup d'œil — bleu profond pour un trajet actif, comme le reste de l'espace chauffeur. */
function heroColorFor(status: TripStatus): string {
  switch (status) {
    case 'COMPLETED':
      return colors.success;
    case 'CANCELLED':
    case 'REFUNDED':
      return colors.textSecondary;
    case 'DISPUTED':
      return colors.danger;
    default:
      return OCEAN.deep;
  }
}

type StageTone = 'ocean' | 'success' | 'gold';

interface Stage {
  icon: IconComponent;
  title: string;
  text: string;
  tone: StageTone;
}

const STAGE_TONES: Record<StageTone, { background: string; foreground: string }> = {
  ocean: { background: OCEAN.mist, foreground: OCEAN.base },
  success: { background: colors.successLight, foreground: colors.successDark },
  gold: { background: OCEAN.goldSoft, foreground: OCEAN.goldInk },
};

function getStage(
  status: TripStatus,
  hasBookings: boolean,
  positionError: string | null | undefined,
  positionMode: string | null | undefined,
): Stage | null {
  switch (status) {
    case 'DRAFT':
      return {
        icon: IconNotes,
        title: 'Trajet en brouillon',
        text: 'Publiez-le pour que les passagers puissent réserver.',
        tone: 'gold',
      };
    case 'PUBLISHED':
      return {
        icon: IconCircleCheck,
        title: 'Trajet publié',
        text: 'Rendez-vous au point de départ, puis signalez votre arrivée.',
        tone: 'ocean',
      };
    case 'DRIVER_ARRIVED':
      return hasBookings
        ? {
            icon: IconUsers,
            title: 'Prise en charge',
            text: 'Demandez le code de chaque passager pour valider sa montée.',
            tone: 'ocean',
          }
        : {
            icon: IconInfoCircle,
            title: 'Aucun passager pour l’instant',
            text: 'Personne n’a réservé ce trajet — vous pouvez attendre une réservation ou l’annuler ci-dessous.',
            tone: 'gold',
          };
    case 'PASSENGER_PICKED_UP':
      return {
        icon: IconCar,
        title: 'Passagers à bord',
        text: 'Tout le monde est monté : vous pouvez démarrer le trajet.',
        tone: 'success',
      };
    case 'IN_PROGRESS':
      if (positionError) {
        return { icon: IconInfoCircle, title: 'Position non partagée', text: positionError, tone: 'gold' };
      }
      return {
        icon: IconRoute,
        title: 'En route',
        text:
          positionMode === 'background'
            ? 'Votre position est partagée avec le passager, même en arrière-plan.'
            : "Votre position est partagée avec le passager tant que l'application reste ouverte.",
        tone: 'success',
      };
    case 'ARRIVED':
      return hasBookings
        ? {
            icon: IconFlag,
            title: 'Dépose des passagers',
            text: 'Validez la dépose de chaque passager avec son code.',
            tone: 'ocean',
          }
        : {
            icon: IconFlag,
            title: 'Arrivé à destination',
            text: 'Il ne reste plus qu’à clôturer le trajet.',
            tone: 'success',
          };
    case 'COMPLETED':
      return { icon: IconCircleCheck, title: 'Trajet terminé', text: 'Ce trajet est clôturé.', tone: 'success' };
    case 'CANCELLED':
      return { icon: IconInfoCircle, title: 'Trajet annulé', text: 'Ce trajet a été annulé.', tone: 'gold' };
    default:
      return null;
  }
}

interface StageAction {
  label: string;
  run: () => void;
  isPending: boolean;
}

// ---------------------------------------------------------------------------
// Petits composants
// ---------------------------------------------------------------------------

/** Une pastille par siège : pleine = plus disponible, vide = libre (déduit du compteur de places du trajet). */
function SeatDots({ total, available }: { total: number; available: number }) {
  if (total > MAX_SEAT_DOTS || total < 1) return null;
  const taken = Math.min(Math.max(total - available, 0), total);
  return (
    <View style={styles.seatDots}>
      {Array.from({ length: total }).map((_, index) => (
        <View key={index} style={[styles.seatDot, index < taken && styles.seatDotTaken]} />
      ))}
    </View>
  );
}

function RouteStop({ eyebrow, city, address }: { eyebrow: string; city: string; address?: string }) {
  return (
    <View style={styles.stop}>
      <AppText variant="xs" color={HERO_MUTED}>
        {eyebrow}
      </AppText>
      <AppText variant="lg" weight="bold" color={colors.onPrimary} numberOfLines={1}>
        {city}
      </AppText>
      {address ? (
        <AppText variant="xs" color={HERO_MUTED} numberOfLines={2}>
          {address}
        </AppText>
      ) : null}
    </View>
  );
}

function Chip({ icon: Icon, label, active }: { icon: IconComponent; label: string; active: boolean }) {
  return (
    <View style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Icon size={14} color={active ? OCEAN.base : colors.textMuted} />
      <AppText variant="xs" weight="medium" color={active ? OCEAN.base : colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

function StageCard({ stage, action }: { stage: Stage; action: StageAction | null }) {
  const tone = STAGE_TONES[stage.tone];
  const Icon = stage.icon;
  return (
    <OceanCard style={styles.stageCard}>
      <View style={styles.stageHeader}>
        <View style={[styles.stageIcon, { backgroundColor: tone.background }]}>
          <Icon size={20} color={tone.foreground} />
        </View>
        <View style={styles.stageText}>
          <AppText variant="base" weight="semibold">
            {stage.title}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {stage.text}
          </AppText>
        </View>
      </View>
      {action ? <OceanButton label={action.label} onPress={action.run} loading={action.isPending} style={styles.stageButton} /> : null}
    </OceanCard>
  );
}

function BookingOtpCard({ booking, tripId, phase }: { booking: Booking; tripId: string; phase: BookingPhase }) {
  const [codeVisible, setCodeVisible] = useState(false);
  const [code, setCode] = useState('');

  const requestPickup = useRequestPickupOtp(booking.id, tripId);
  const verifyPickup = useVerifyPickupOtp(booking.id, tripId);
  const requestDropoff = useRequestDropoffOtp(booking.id, tripId);
  const verifyDropoff = useVerifyDropoffOtp(booking.id, tripId);
  const getOrCreateConversation = useGetOrCreateConversationForBooking();

  const names = booking.passengers?.map((p) => p.fullName) ?? [];
  const passengerNames = names.join(', ') || `${booking.seatsCount} place(s)`;
  const firstName = names[0];
  const initials = firstName
    ? firstName
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase()
    : '';

  function handleRequest() {
    const mutation = phase === 'pickup' ? requestPickup : requestDropoff;
    mutation.mutate(undefined, {
      onSuccess: () => setCodeVisible(true),
      onError: () => Alert.alert('Erreur', "L'envoi du code a échoué — réessayez."),
    });
  }

  function handleVerify() {
    const mutation = phase === 'pickup' ? verifyPickup : verifyDropoff;
    mutation.mutate(code, {
      onSuccess: () => {
        setCodeVisible(false);
        setCode('');
      },
      onError: (error) => {
        Alert.alert('Code invalide', error instanceof ApiError ? error.message : 'Réessayez.');
      },
    });
  }

  const isRequesting = phase === 'pickup' ? requestPickup.isPending : requestDropoff.isPending;
  const isVerifying = phase === 'pickup' ? verifyPickup.isPending : verifyDropoff.isPending;

  return (
    <OceanCard style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.avatar}>
          {initials ? (
            <AppText variant="sm" weight="bold" color={OCEAN.base}>
              {initials}
            </AppText>
          ) : (
            <IconUsers size={18} color={OCEAN.base} />
          )}
        </View>
        <View style={styles.bookingText}>
          <AppText variant="base" weight="semibold" numberOfLines={1}>
            {passengerNames}
          </AppText>
          <View style={styles.bookingMeta}>
            <AppText variant="xs" color="textSecondary">
              {booking.seatsCount} place{booking.seatsCount > 1 ? 's' : ''}
            </AppText>
            <OceanPill
              label={DRIVER_BOOKING_STATUS_LABELS[booking.status]}
              tone={booking.status === 'CONFIRMED' ? 'success' : 'neutral'}
            />
          </View>
        </View>
        <IconButton
          icon={<IconMessageCircle size={16} color={colors.textPrimary} />}
          accessibilityLabel="Contacter le passager"
          onPress={() =>
            getOrCreateConversation.mutate(booking.id, {
              onSuccess: (conversation) => router.push(`/(driver)/conversation/${conversation.id}`),
            })
          }
        />
      </View>

      {phase !== 'none' ? (
        <View style={styles.otpPanel}>
          <AppText variant="sm" weight="semibold">
            {phase === 'pickup' ? 'Valider la prise en charge' : 'Valider la dépose'}
          </AppText>
          {!codeVisible ? (
            <>
              <AppText variant="xs" color="textSecondary">
                Le passager reçoit un code à 6 chiffres à vous communiquer.
              </AppText>
              <OceanButton
                label={phase === 'pickup' ? 'Demander le code de prise en charge' : 'Demander le code de dépose'}
                variant="soft"
                onPress={handleRequest}
                loading={isRequesting}
              />
            </>
          ) : (
            <>
              <AppText variant="xs" color="textSecondary">
                Code envoyé. Saisissez celui que le passager vous donne.
              </AppText>
              <View style={styles.codeRow}>
                <TextField
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="Code à 6 chiffres"
                  maxLength={6}
                  style={styles.codeInput}
                />
                <OceanButton label="Vérifier" onPress={handleVerify} loading={isVerifying} disabled={code.length !== 6} />
              </View>
            </>
          )}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/(driver)/dispute-new',
            params: { subjectType: 'TRIP', bookingId: booking.id },
          })
        }
        style={({ pressed }) => [styles.reportLink, pressed && styles.pressed]}
      >
        <IconFlag size={13} color={colors.textMuted} />
        <AppText variant="xs" color="textMuted">
          Signaler un problème
        </AppText>
      </Pressable>
    </OceanCard>
  );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function DriverTripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, isLoading, isError } = useTrip(id);
  const { data: bookings } = useTripBookings(id);

  const publishTrip = usePublishTrip(id ?? '');
  const markDriverArrived = useMarkDriverArrived(id ?? '');
  const startTrip = useStartTrip(id ?? '');
  const markArrived = useMarkTripArrived(id ?? '');
  const completeTrip = useCompleteTrip(id ?? '');
  const cancelTrip = useCancelTrip(id ?? '');
  const { error: positionError, mode: positionMode } = useTripPositionBroadcast(id ?? '', trip?.status === 'IN_PROGRESS');

  if (isLoading || !trip) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
        {isError ? (
          <AppText variant="sm" color="danger">
            Impossible de charger ce trajet.
          </AppText>
        ) : (
          <ActivityIndicator color={OCEAN.base} />
        )}
      </ScreenContainer>
    );
  }

  const activeBookings = (bookings ?? []).filter((b) => b.status === 'CONFIRMED');

  const phase: BookingPhase =
    trip.status === 'DRIVER_ARRIVED' || trip.status === 'PASSENGER_PICKED_UP'
      ? 'pickup'
      : trip.status === 'ARRIVED'
        ? 'dropoff'
        : 'none';

  function handleCancel() {
    Alert.alert('Annuler ce trajet ?', 'Toutes les réservations actives seront annulées.', [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Annuler le trajet',
        style: 'destructive',
        onPress: () =>
          cancelTrip.mutate(
            { reason: "Annulé depuis l'application" },
            { onError: () => Alert.alert('Erreur', "L'annulation a échoué.") },
          ),
      },
    ]);
  }

  // Une seule action possible à la fois, selon l'état du trajet.
  let action: StageAction | null = null;
  if (trip.status === 'DRAFT') {
    action = { label: 'Publier le trajet', run: () => publishTrip.mutate(), isPending: publishTrip.isPending };
  } else if (trip.status === 'PUBLISHED') {
    action = {
      label: 'Signaler mon arrivée au départ',
      run: () => markDriverArrived.mutate(),
      isPending: markDriverArrived.isPending,
    };
  } else if (trip.status === 'PASSENGER_PICKED_UP') {
    action = { label: 'Démarrer le trajet', run: () => startTrip.mutate(), isPending: startTrip.isPending };
  } else if (trip.status === 'IN_PROGRESS') {
    action = {
      label: "Signaler l'arrivée à destination",
      run: () => markArrived.mutate(),
      isPending: markArrived.isPending,
    };
  } else if (trip.status === 'ARRIVED' && activeBookings.length === 0) {
    action = { label: 'Clôturer le trajet', run: () => completeTrip.mutate(), isPending: completeTrip.isPending };
  }

  const stage = getStage(trip.status, activeBookings.length > 0, positionError, positionMode);

  const originAddress =
    trip.originLocation?.label && trip.originLocation.label !== trip.originCity.name ? trip.originLocation.label : undefined;
  const destinationAddress =
    trip.destinationLocation?.label && trip.destinationLocation.label !== trip.destinationCity.name
      ? trip.destinationLocation.label
      : undefined;

  const seatsTitle = formatSeatsAvailability(trip.availableSeats);

  const canReceiveBookings = ['DRAFT', 'PUBLISHED', 'BOOKING_PENDING', 'CONFIRMED'].includes(trip.status);
  const showPassengers = activeBookings.length > 0 || canReceiveBookings;

  const luggageLabel = trip.allowsLuggage ? 'Bagages acceptés' : 'Sans bagages';
  let shipmentsLabel = 'Sans envois';
  if (trip.allowsShipments) {
    if (trip.maxShipmentWeightKg != null && trip.availableShipmentWeightKg != null) {
      shipmentsLabel = `Envois · ${formatKg(trip.availableShipmentWeightKg)}/${formatKg(trip.maxShipmentWeightKg)} kg`;
    } else if (trip.maxShipmentWeightKg != null) {
      shipmentsLabel = `Envois · jusqu'à ${formatKg(trip.maxShipmentWeightKg)} kg`;
    } else {
      shipmentsLabel = 'Envois acceptés';
    }
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Détail du trajet" onBack={() => router.back()} />

      {/* Billet : bandeau coloré + coupon détachable */}
      <View style={styles.ticketShadow}>
        <View style={styles.ticket}>
          <View style={[styles.hero, { backgroundColor: heroColorFor(trip.status) }]}>
            <View style={styles.decoLarge} />
            <View style={styles.decoSmall} />

            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <AppText variant="xs" weight="semibold" color={colors.onPrimary}>
                {TRIP_STATUS_LABELS[trip.status]}
              </AppText>
            </View>

            <View style={styles.when}>
              <AppText variant="sm" color={HERO_MUTED}>
                {capitalize(formatDateLong(trip.departureAt))}
              </AppText>
              <AppText variant="xxl" weight="bold" color={colors.onPrimary}>
                {formatTime(trip.departureAt)}
              </AppText>
            </View>

            <View style={styles.route}>
              <View style={styles.rail}>
                <View style={styles.railDotOrigin} />
                <View style={styles.railLine} />
                <View style={styles.railDotDestination} />
              </View>
              <View style={styles.stops}>
                <RouteStop eyebrow="Départ" city={trip.originCity.name} address={originAddress} />
                <RouteStop eyebrow="Arrivée" city={trip.destinationCity.name} address={destinationAddress} />
              </View>
            </View>
          </View>

          <View style={styles.tear}>
            <View style={[styles.notch, styles.notchLeft]} />
            <View style={styles.dashWrap}>
              <View style={styles.dash} />
            </View>
            <View style={[styles.notch, styles.notchRight]} />
          </View>

          <View style={styles.coupon}>
            <View style={styles.couponColumn}>
              <AppText variant="xs" color="textSecondary">
                Places
              </AppText>
              <AppText variant="md" weight="bold">
                {seatsTitle}
              </AppText>
              <SeatDots total={trip.totalSeats} available={trip.availableSeats} />
              <AppText variant="xs" color="textMuted">
                {trip.totalSeats} place{trip.totalSeats > 1 ? 's' : ''} au total
              </AppText>
            </View>
            <View style={styles.couponDivider} />
            <View style={[styles.couponColumn, styles.couponColumnRight]}>
              <AppText variant="xs" color="textSecondary">
                Prix par place
              </AppText>
              <AppText variant="md" weight="bold">
                {formatMoney(trip.pricePerSeat)}
              </AppText>
            </View>
          </View>
        </View>
      </View>

      {stage ? <StageCard stage={stage} action={action} /> : null}

      {showPassengers ? (
        <OceanSection
          icon={<IconUsers size={17} color={OCEAN.base} />}
          title="Passagers"
          action={
            activeBookings.length > 0 ? (
              <View style={styles.countPill}>
                <AppText variant="xs" weight="semibold" color={OCEAN.base}>
                  {activeBookings.length}
                </AppText>
              </View>
            ) : undefined
          }
        >
          {activeBookings.length > 0 ? (
            <View style={styles.bookingsList}>
              {activeBookings.map((booking) => (
                <BookingOtpCard key={booking.id} booking={booking} tripId={trip.id} phase={phase} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyBookings}>
              <View style={styles.emptyIcon}>
                <IconUsers size={22} color={OCEAN.base} />
              </View>
              <AppText variant="sm" weight="semibold">
                Aucune réservation confirmée
              </AppText>
              <AppText variant="xs" color="textSecondary" style={styles.emptyText}>
                {trip.status === 'DRAFT'
                  ? 'Publiez le trajet pour recevoir des réservations.'
                  : 'Les passagers apparaîtront ici dès que leur réservation est confirmée.'}
              </AppText>
            </View>
          )}
        </OceanSection>
      ) : null}

      <OceanSection icon={<IconCar size={17} color={OCEAN.base} />} title="Détails">
        <View style={styles.detailCard}>
          {trip.vehicle.photoUrl ? (
            <Image source={{ uri: trip.vehicle.photoUrl }} style={styles.vehiclePhoto} />
          ) : (
            <View style={styles.vehicleIcon}>
              <IconCar size={22} color={OCEAN.base} />
            </View>
          )}
          <View style={styles.vehicleText}>
            <AppText variant="base" weight="semibold" numberOfLines={1}>
              {trip.vehicle.brand} {trip.vehicle.model}
            </AppText>
            <AppText variant="xs" color="textSecondary" numberOfLines={1}>
              {[trip.vehicle.color, `${trip.vehicle.totalSeats} places`].filter(Boolean).join(' · ')}
            </AppText>
          </View>
          <View style={styles.plate}>
            <AppText variant="xs" weight="bold">
              {trip.vehicle.plateNumber}
            </AppText>
          </View>
        </View>

        <View style={styles.chips}>
          <Chip icon={IconLuggage} label={luggageLabel} active={trip.allowsLuggage} />
          <Chip icon={IconPackage} label={shipmentsLabel} active={trip.allowsShipments} />
        </View>

        {trip.notes ? (
          <View style={styles.notes}>
            <IconNotes size={16} color={colors.textSecondary} />
            <AppText variant="sm" color="textSecondary" style={styles.notesText}>
              {trip.notes}
            </AppText>
          </View>
        ) : null}
      </OceanSection>

      {['DRAFT', 'PUBLISHED', 'DRIVER_ARRIVED'].includes(trip.status) ? (
        <OceanButton
          label="Annuler le trajet"
          variant="outline"
          onPress={handleCancel}
          loading={cancelTrip.isPending}
          style={styles.cancelButton}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },

  // Billet
  ticketShadow: {
    borderRadius: 28,
    marginBottom: spacing.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  ticket: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg + spacing.xs,
    gap: spacing.md,
    overflow: 'hidden',
  },
  decoLarge: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decoSmall: {
    position: 'absolute',
    bottom: -40,
    left: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: HERO_SOFT,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.onPrimary,
  },
  when: {
    gap: 2,
  },
  route: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  rail: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  railDotOrigin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.onPrimary,
  },
  railLine: {
    flex: 1,
    width: 2,
    minHeight: 24,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginVertical: 4,
  },
  railDotDestination: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.onPrimary,
  },
  stops: {
    flex: 1,
    justifyContent: 'space-between',
  },
  stop: {
    gap: 1,
  },
  tear: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  notch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  notchLeft: {
    marginLeft: -10,
  },
  notchRight: {
    marginRight: -10,
  },
  dashWrap: {
    flex: 1,
    paddingHorizontal: 4,
  },
  dash: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
  },
  coupon: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  couponColumn: {
    flex: 1,
    gap: 2,
  },
  couponColumnRight: {
    alignItems: 'flex-end',
  },
  couponDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  seatDots: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 2,
  },
  seatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: OCEAN.base,
  },
  seatDotTaken: {
    backgroundColor: OCEAN.base,
  },

  // Puces
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  chipActive: {
    backgroundColor: OCEAN.mist,
  },
  chipInactive: {
    backgroundColor: colors.surfaceMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },

  // Étape suivante
  stageCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stageIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageText: {
    flex: 1,
    gap: 2,
  },
  stageButton: {
    marginTop: spacing.xs,
  },

  // Passagers
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingsList: {
    gap: spacing.sm,
  },
  bookingCard: {
    gap: spacing.sm,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingText: {
    flex: 1,
    gap: 2,
  },
  bookingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  otpPanel: {
    gap: spacing.xs,
    borderRadius: 16,
    backgroundColor: OCEAN.mist,
    padding: spacing.sm + 2,
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  codeInput: {
    flex: 1,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  emptyBookings: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: '85%',
  },

  // Détails
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vehiclePhoto: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleText: {
    flex: 1,
    gap: 1,
  },
  plate: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  notes: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  notesText: {
    flex: 1,
  },

  cancelButton: {
    marginBottom: spacing.lg,
  },
});