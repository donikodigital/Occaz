// mobile/app/(driver)/trip/[id].tsx
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft, IconCar, IconMessageCircle, IconUsers } from '@tabler/icons-react-native';
import { AppText, Badge, Button, Card, Divider, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useTrip } from '@/hooks/useTripSearch';
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
import { formatDateLong, formatTime } from '@/utils/date';
import { DRIVER_BOOKING_STATUS_LABELS, TRIP_STATUS_LABELS, TRIP_STATUS_TONE } from '@/utils/tripStatusLabels';
import { ApiError } from '@/services/api/ApiError';
import type { Booking } from '@/types/bookings.types';

type BookingPhase = 'pickup' | 'dropoff' | 'none';

function BookingOtpCard({ booking, tripId, phase }: { booking: Booking; tripId: string; phase: BookingPhase }) {
  const [codeVisible, setCodeVisible] = useState(false);
  const [code, setCode] = useState('');

  const requestPickup = useRequestPickupOtp(booking.id, tripId);
  const verifyPickup = useVerifyPickupOtp(booking.id, tripId);
  const requestDropoff = useRequestDropoffOtp(booking.id, tripId);
  const verifyDropoff = useVerifyDropoffOtp(booking.id, tripId);
  const getOrCreateConversation = useGetOrCreateConversationForBooking();

  const passengerNames = booking.passengers?.map((p) => p.fullName).join(', ') || `${booking.seatsCount} place(s)`;

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
    <Card style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.bookingIcon}>
          <IconUsers size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="sm" weight="semibold" numberOfLines={1}>
            {passengerNames}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            {booking.seatsCount} place{booking.seatsCount > 1 ? 's' : ''}
          </AppText>
        </View>
        <Badge label={DRIVER_BOOKING_STATUS_LABELS[booking.status]} tone={booking.status === 'CONFIRMED' ? 'success' : 'neutral'} />
        <IconButton
          icon={<IconMessageCircle size={15} color={colors.textPrimary} />}
          accessibilityLabel="Contacter le passager"
          onPress={() =>
            getOrCreateConversation.mutate(booking.id, {
              onSuccess: (conversation) => router.push(`/(driver)/conversation/${conversation.id}`),
            })
          }
        />
      </View>

      {phase !== 'none' ? (
        <View style={styles.otpBlock}>
          {!codeVisible ? (
            <Button
              label={phase === 'pickup' ? 'Demander le code de prise en charge' : 'Demander le code de dépose'}
              variant="secondary"
              size="md"
              onPress={handleRequest}
              loading={isRequesting}
            />
          ) : (
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
          )}
        </View>
      ) : null}
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(driver)/dispute-new',
            params: { subjectType: 'TRIP', bookingId: booking.id },
          })
        }
      >
        <AppText variant="xs" color="textMuted" style={styles.reportLink}>
          Signaler un problème
        </AppText>
      </Pressable>
    </Card>
  );
}

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

  function runLifecycleAction(mutation: { mutate: () => void }) {
    mutation.mutate();
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <Badge label={TRIP_STATUS_LABELS[trip.status]} tone={TRIP_STATUS_TONE[trip.status]} />
      </View>

      <Card style={styles.card}>
        <AppText variant="sm" color="textSecondary">
          {trip.originCity.name} → {trip.destinationCity.name}
        </AppText>
        <AppText variant="lg" weight="semibold">
          {formatDateLong(trip.departureAt)} à {formatTime(trip.departureAt)}
        </AppText>

        <Divider />

        <View style={styles.vehicleRow}>
          <IconCar size={16} color={colors.textSecondary} />
          <AppText variant="sm" color="textSecondary">
            {trip.vehicle.brand} {trip.vehicle.model} · {trip.vehicle.plateNumber}
          </AppText>
        </View>
        <AppText variant="sm" color="textSecondary">
          {trip.availableSeats}/{trip.totalSeats} places disponibles · {formatMoney(trip.pricePerSeat)} / place
        </AppText>
      </Card>

      {trip.status === 'DRAFT' ? (
        <Button label="Publier le trajet" onPress={() => runLifecycleAction(publishTrip)} loading={publishTrip.isPending} style={styles.actionButton} />
      ) : null}

      {trip.status === 'PUBLISHED' ? (
        <Button
          label="Signaler mon arrivée au départ"
          onPress={() => runLifecycleAction(markDriverArrived)}
          loading={markDriverArrived.isPending}
          style={styles.actionButton}
        />
      ) : null}

      {trip.status === 'PASSENGER_PICKED_UP' ? (
        <Button
          label="Démarrer le trajet"
          onPress={() => runLifecycleAction(startTrip)}
          loading={startTrip.isPending}
          style={styles.actionButton}
        />
      ) : null}

      {trip.status === 'IN_PROGRESS' ? (
        <Button
          label="Signaler l'arrivée à destination"
          onPress={() => runLifecycleAction(markArrived)}
          loading={markArrived.isPending}
          style={styles.actionButton}
        />
      ) : null}

      {trip.status === 'ARRIVED' && activeBookings.length === 0 ? (
        <Button
          label="Clôturer le trajet"
          onPress={() => runLifecycleAction(completeTrip)}
          loading={completeTrip.isPending}
          style={styles.actionButton}
        />
      ) : null}

      {activeBookings.length > 0 ? (
        <>
          <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
            Passagers
          </AppText>
          <View style={styles.bookingsList}>
            {activeBookings.map((booking) => (
              <BookingOtpCard key={booking.id} booking={booking} tripId={trip.id} phase={phase} />
            ))}
          </View>
        </>
      ) : null}

      {['DRAFT', 'PUBLISHED'].includes(trip.status) ? (
        <Button
          label="Annuler le trajet"
          variant="outline"
          onPress={handleCancel}
          loading={cancelTrip.isPending}
          style={styles.actionButton}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  card: {
    gap: 4,
    marginBottom: spacing.md,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  bookingsList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bookingCard: {
    gap: spacing.sm,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bookingIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBlock: {
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reportLink: {
    marginTop: spacing.xs,
    textDecorationLine: 'underline',
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  codeInput: {
    flex: 1,
  },
});
