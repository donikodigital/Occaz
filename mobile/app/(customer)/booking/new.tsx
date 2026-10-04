// mobile/app/(customer)/booking/new.tsx
// [23/09/2026] v+ — champ « Code promo », entre le nombre de places et le récapitulatif.
// [03/10/2026] v+ — Tronçon réservé : le prix et le récapitulatif sont ceux du tronçon choisi (ex. Kindia → Labé).
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft, IconMinus, IconPlus } from '@tabler/icons-react-native';
import { AppText, Button, Card, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { PromoCodeField } from '@/components/screens/PromoCodeField';
import { colors, spacing } from '@/theme';
import { useTrip } from '@/hooks/useTripSearch';
import { useCreateBooking } from '@/hooks/useBookings';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import { segmentAvailableSeats } from '@/utils/tripSegment';
import type { PassengerInput } from '@/types/bookings.types';

export default function NewBookingScreen() {
  const { tripId, boardingStopId, alightingStopId } = useLocalSearchParams<{
    tripId: string;
    boardingStopId?: string;
    alightingStopId?: string;
  }>();
  const { data: trip, isLoading } = useTrip(tripId, { boardingStopId, alightingStopId });
  const { data: profile } = useCustomerProfile();
  const [seatsCount, setSeatsCount] = useState(1);
  const [extraPassengers, setExtraPassengers] = useState<PassengerInput[]>([]);
  const [promoCode, setPromoCode] = useState<string | undefined>();
  const [promoDiscount, setPromoDiscount] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const createBooking = useCreateBooking();

  if (isLoading || !trip) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
        <ActivityIndicator color={colors.primary} />
      </ScreenContainer>
    );
  }

  // Places libres sur le tronçon du client : un siège pris jusqu'à Kindia est de nouveau libre après.
  const availableSeats = segmentAvailableSeats(trip);
  const maxSeats = Math.min(availableSeats, 8);
  // Le prix client (commission incluse) — jamais le prix brut du
  // chauffeur, qui ne regarde ni le client ni cet écran.
  const customerPricePerSeat = Number(trip.customerPricePerSeat ?? trip.pricePerSeat);
  const totalAmount = customerPricePerSeat * seatsCount;
  const discountAmount = promoDiscount ? Number(promoDiscount) : 0;
  const amountDue = Math.max(0, totalAmount - discountAmount);

  function adjustSeats(delta: number) {
    const next = Math.min(maxSeats, Math.max(1, seatsCount + delta));
    setSeatsCount(next);
    setExtraPassengers((current) => {
      const needed = next - 1;
      if (needed <= current.length) return current.slice(0, needed);
      return [...current, ...Array.from({ length: needed - current.length }, () => ({ fullName: '' }))];
    });
    // Le montant de base change avec le nombre de places — une réduction
    // déjà validée contre l'ancien montant n'est plus fiable, on la
    // retire plutôt que d'afficher un total qui ne correspondrait plus
    // à ce que le serveur calculera réellement à la confirmation.
    if (promoCode) {
      setPromoCode(undefined);
      setPromoDiscount(undefined);
    }
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
      { tripId: trip.id, seatsCount, passengers, promoCode, boardingStopId, alightingStopId },
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
          {trip.segment?.boardingCityName ?? trip.originCity.name} → {trip.segment?.alightingCityName ?? trip.destinationCity.name}
        </AppText>
        <AppText variant="base" weight="medium">
          {trip.driver.firstName} {trip.driver.lastName[0]}. · {formatMoney(String(customerPricePerSeat))} / place
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
          sur {availableSeats} disponible{availableSeats > 1 ? 's' : ''}
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

      <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
        Code promo
      </AppText>
      <View style={styles.promoField}>
        <PromoCodeField
          serviceType="TRIP"
          amount={String(totalAmount)}
          appliedCode={promoCode}
          onChange={(code, discount) => {
            setPromoCode(code);
            setPromoDiscount(discount);
          }}
        />
      </View>

      <Card style={styles.priceCard}>
        <View style={styles.priceRow}>
          <AppText variant="base" weight="semibold">
            Total à payer
          </AppText>
          <AppText variant="lg" weight="bold">
            {formatMoney(String(amountDue))}
          </AppText>
        </View>
        {seatsCount > 1 ? (
          <AppText variant="xs" color="textMuted">
            {formatMoney(String(customerPricePerSeat))} × {seatsCount} place{seatsCount > 1 ? 's' : ''}
          </AppText>
        ) : null}
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
  promoField: {
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