// mobile/app/(customer)/booking/new.tsx
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft, IconMinus, IconPlus } from '@tabler/icons-react-native';
import { AppText, Button, Card, Divider, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useTrip } from '@/hooks/useTripSearch';
import { useCreateBooking } from '@/hooks/useBookings';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import type { PassengerInput } from '@/types/bookings.types';

export default function NewBookingScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading } = useTrip(tripId);
  const { data: profile } = useCustomerProfile();
  const [seatsCount, setSeatsCount] = useState(1);
  const [extraPassengers, setExtraPassengers] = useState<PassengerInput[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const createBooking = useCreateBooking();

  if (isLoading || !trip) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
        <ActivityIndicator color={colors.primary} />
      </ScreenContainer>
    );
  }

  const maxSeats = Math.min(trip.availableSeats, 8);
  const baseAmount = Number(trip.pricePerSeat) * seatsCount;

  function adjustSeats(delta: number) {
    const next = Math.min(maxSeats, Math.max(1, seatsCount + delta));
    setSeatsCount(next);
    setExtraPassengers((current) => {
      const needed = next - 1;
      if (needed <= current.length) return current.slice(0, needed);
      return [...current, ...Array.from({ length: needed - current.length }, () => ({ fullName: '' }))];
    });
  }

  function updatePassengerName(index: number, fullName: string) {
    setExtraPassengers((current) => current.map((p, i) => (i === index ? { ...p, fullName } : p)));
  }

  function handleConfirm() {
    if (!trip) return;
    setErrorMessage(undefined);

    if (seatsCount > 1 && extraPassengers.some((p) => p.fullName.trim().length < 2)) {
      setErrorMessage('Renseignez le nom de chaque passager.');
      return;
    }

    const passengers: PassengerInput[] | undefined =
      seatsCount === 1
        ? undefined
        : [
            { fullName: `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() },
            ...extraPassengers,
          ];

    createBooking.mutate(
      { tripId: trip.id, seatsCount, passengers },
      {
        onSuccess: (booking) => router.replace(`/(customer)/booking/${booking.id}`),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Réserver
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <Card style={styles.routeSummary}>
        <AppText variant="sm" color="textSecondary">
          {trip.originCity.name} → {trip.destinationCity.name}
        </AppText>
        <AppText variant="base" weight="medium">
          {trip.driver.firstName} {trip.driver.lastName[0]}. · {formatMoney(trip.pricePerSeat)} / place
        </AppText>
      </Card>

      <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
        Nombre de places
      </AppText>
      <View style={styles.stepper}>
        <IconButton
          icon={<IconMinus size={16} color={colors.textPrimary} />}
          accessibilityLabel="Retirer une place"
          onPress={() => adjustSeats(-1)}
        />
        <AppText variant="lg" weight="semibold" style={styles.stepperValue}>
          {seatsCount}
        </AppText>
        <IconButton
          icon={<IconPlus size={16} color={colors.textPrimary} />}
          accessibilityLabel="Ajouter une place"
          onPress={() => adjustSeats(1)}
        />
        <AppText variant="sm" color="textMuted">
          sur {trip.availableSeats} disponible{trip.availableSeats > 1 ? 's' : ''}
        </AppText>
      </View>

      {extraPassengers.length > 0 ? (
        <>
          <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
            Autres passagers
          </AppText>
          <View style={styles.passengerFields}>
            {extraPassengers.map((passenger, index) => (
              <TextField
                key={index}
                label={`Passager ${index + 2}`}
                value={passenger.fullName}
                onChangeText={(text) => updatePassengerName(index, text)}
                placeholder="Nom complet"
              />
            ))}
          </View>
        </>
      ) : null}

      <Card style={styles.priceCard}>
        <View style={styles.priceRow}>
          <AppText variant="sm" color="textSecondary">
            {formatMoney(trip.pricePerSeat)} × {seatsCount}
          </AppText>
          <AppText variant="sm">{formatMoney(String(baseAmount))}</AppText>
        </View>
        <Divider />
        <AppText variant="xs" color="textMuted">
          Les frais de service sont calculés à l'étape suivante, avant paiement.
        </AppText>
      </Card>

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button
        label="Confirmer la réservation"
        onPress={handleConfirm}
        loading={createBooking.isPending}
        style={styles.submit}
      />
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
  routeSummary: {
    marginBottom: spacing.lg,
    gap: 4,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
  },
  passengerFields: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  priceCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});
