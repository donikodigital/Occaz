// mobile/app/(driver)/trip/[id].tsx
//
// v2 — Refonte visuelle complète, logique métier inchangée (mêmes hooks,
// mêmes actions, mêmes codes OTP).
//   - Le trajet devient un « billet » : bandeau coloré avec l'heure de
//     départ et l'itinéraire en frise verticale (ville + adresse choisie),
//     puis coupon détachable avec les places (une pastille par siège) et
//     le prix. La couleur du bandeau suit l'état : indigo en cours de vie,
//     vert une fois terminé, gris si annulé, rouge en litige.
//   - « Étape suivante » : une carte explique où en est le trajet et porte
//     l'unique action à faire, au lieu de boutons empilés sous la fiche.
//   - Passagers : cartes avec initiales, zone de validation par code
//     clairement séparée, et un vrai état vide.
//   - Détails : véhicule (plaque en évidence), bagages/envois, note.

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
import { AppText, Badge, Button, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
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

const HERO_MUTED = 'rgba(255,255,255,0.72)';
const HERO_SOFT = 'rgba(255,255,255,0.18)';
const MAX_SEAT_DOTS = 10;

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function formatKg(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** La couleur du bandeau raconte l'état du trajet au premier coup d'œil. */
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
      return colors.primary;
  }
}

type StageTone = 'primary' | 'success' | 'accent';

interface Stage {
  icon: IconComponent;
  title: string;
  text: string;
  tone: StageTone;
}

const STAGE_TONES: Record<StageTone, { background: string; foreground: string }> = {
  primary: { background: colors.primaryLight, foreground: colors.primary },
  success: { background: colors.successLight, foreground: colors.success },
  accent: { background: colors.accentLight, foreground: colors.accentDark },
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
        tone: 'accent',
      };
    case 'PUBLISHED':
      return {
        icon: IconCircleCheck,
        title: 'Trajet publié',
        text: 'Rendez-vous au point de départ, puis signalez votre arrivée.',
        tone: 'primary',
      };
    case 'DRIVER_ARRIVED':
      return {
        icon: IconUsers,
        title: 'Prise en charge',
        text: 'Demandez le code de chaque passager pour valider sa montée.',
        tone: 'primary',
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
        return { icon: IconInfoCircle, title: 'Position non partagée', text: positionError, tone: 'accent' };
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
            tone: 'primary',
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
      return { icon: IconInfoCircle, title: 'Trajet annulé', text: 'Ce trajet a été annulé.', tone: 'accent' };
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
      <Icon size={14} color={active ? colors.primary : colors.textMuted} />
      <AppText variant="xs" weight="medium" color={active ? colors.primary : colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

function StageCard({ stage, action }: { stage: Stage; action: StageAction | null }) {
  const tone = STAGE_TONES[stage.tone];
  const Icon = stage.icon;
  return (
    <View style={styles.stageCard}>
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
      {action ? <Button label={action.label} onPress={action.run} loading={action.isPending} style={styles.stageButton} /> : null}
    </View>
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
    <View style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.avatar}>
          {initials ? (
            <AppText variant="sm" weight="bold" color="primary">
              {initials}
            </AppText>
          ) : (
            <IconUsers size={18} color={colors.primary} />
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
            <Badge
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
              <Button
                label={phase === 'pickup' ? 'Demander le code de prise en charge' : 'Demander le code de dépose'}
                variant="secondary"
                size="md"
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
                <Button
                  label="Vérifier"
                  size="md"
                  fullWidth={false}
                  onPress={handleVerify}
                  loading={isVerifying}
                  disabled={code.length !== 6}
                />
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
    </View>
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
          <ActivityIndicator color={colors.primary} />
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
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="md" weight="semibold">
          Détail du trajet
        </AppText>
      </View>

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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AppText variant="md" weight="semibold">
              Passagers
            </AppText>
            {activeBookings.length > 0 ? (
              <View style={styles.countPill}>
                <AppText variant="xs" weight="semibold" color="primary">
                  {activeBookings.length}
                </AppText>
              </View>
            ) : null}
          </View>

          {activeBookings.length > 0 ? (
            <View style={styles.bookingsList}>
              {activeBookings.map((booking) => (
                <BookingOtpCard key={booking.id} booking={booking} tripId={trip.id} phase={phase} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyBookings}>
              <View style={styles.emptyIcon}>
                <IconUsers size={22} color={colors.primary} />
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
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="md" weight="semibold" style={styles.sectionTitle}>
          Détails
        </AppText>

        <View style={styles.detailCard}>
          {trip.vehicle.photoUrl ? (
            <Image source={{ uri: trip.vehicle.photoUrl }} style={styles.vehiclePhoto} />
          ) : (
            <View style={styles.vehicleIcon}>
              <IconCar size={22} color={colors.primary} />
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
      </View>

      {['DRAFT', 'PUBLISHED'].includes(trip.status) ? (
        <Button
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
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
    marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  railDotDestination: {
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: colors.onPrimary,
  },
  stops: {
    flex: 1,
    gap: spacing.md,
  },
  stop: {
    gap: 2,
  },

  // Coupon détachable
  tear: {
    height: 24,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  notch: {
    position: 'absolute',
    top: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  notchLeft: {
    left: -10,
  },
  notchRight: {
    right: -10,
  },
  dashWrap: {
    height: 1,
    marginHorizontal: 18,
    overflow: 'hidden',
  },
  dash: {
    height: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 1,
  },
  coupon: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  couponColumn: {
    flex: 1,
    gap: 4,
  },
  couponColumnRight: {
    alignItems: 'flex-end',
  },
  couponDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  seatDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginVertical: 2,
  },
  seatDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  seatDotTaken: {
    backgroundColor: colors.primary,
  },

  // Étape suivante
  stageCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  stageIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageText: {
    flex: 1,
    gap: 2,
  },
  stageButton: {
    marginTop: 0,
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Passagers
  bookingsList: {
    gap: spacing.sm,
  },
  bookingCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingText: {
    flex: 1,
    gap: 3,
  },
  bookingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  otpPanel: {
    gap: spacing.xs + 2,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
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
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 2,
  },
  emptyBookings: {
    alignItems: 'center',
    gap: spacing.xxs + 2,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  emptyText: {
    textAlign: 'center',
  },

  // Détails
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  vehiclePhoto: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleText: {
    flex: 1,
    gap: 2,
  },
  plate: {
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
  },
  chipInactive: {
    backgroundColor: colors.surfaceMuted,
  },
  notes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: spacing.sm + 2,
  },
  notesText: {
    flex: 1,
  },
  cancelButton: {
    marginBottom: spacing.lg,
  },
});