// mobile/app/(customer)/booking/[id].tsx
import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft, IconCheck } from '@tabler/icons-react-native';
import { AppText, Badge, Button, Card, Divider, IconButton, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useBooking, useCancelBooking } from '@/hooks/useBookings';
import { formatMoney } from '@/utils/money';
import { formatDateLong, formatTime } from '@/utils/date';
import type { BookingStatus } from '@/types/bookings.types';

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Terminée',
  REFUNDED: 'Remboursée',
  DISPUTED: 'En litige',
};

const CANCELLABLE_STATUSES: BookingStatus[] = ['PENDING_PAYMENT', 'PAID', 'CONFIRMED'];

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: booking, isLoading, isError } = useBooking(id);
  const cancelBooking = useCancelBooking(id ?? '');

  if (isLoading || !booking) {
    return (
      <ScreenContainer style={styles.center}>
        {isError ? (
          <AppText variant="sm" color="danger">
            Impossible de charger cette réservation.
          </AppText>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </ScreenContainer>
    );
  }

  const trip = booking.trip;
  const canCancel = CANCELLABLE_STATUSES.includes(booking.status);

  function handleCancel() {
    Alert.alert('Annuler la réservation ?', 'Cette action ne peut pas être annulée.', [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Annuler la réservation',
        style: 'destructive',
        onPress: () =>
          cancelBooking.mutate(
            { reason: "Annulée depuis l'application" },
            {
              onError: () => Alert.alert('Erreur', "L'annulation a échoué — réessayez."),
            },
          ),
      },
    ]);
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Réservation
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.statusBlock}>
        <View style={styles.statusIcon}>
          <IconCheck size={26} color={colors.successDark} />
        </View>
        <Badge
          label={STATUS_LABELS[booking.status]}
          tone={booking.status === 'CANCELLED' ? 'danger' : booking.status === 'CONFIRMED' ? 'success' : 'primary'}
        />
      </View>

      {trip ? (
        <Card style={styles.card}>
          <AppText variant="sm" color="textSecondary">
            {trip.originCity.name} → {trip.destinationCity.name}
          </AppText>
          <AppText variant="base" weight="semibold">
            {formatDateLong(trip.departureAt)} à {formatTime(trip.departureAt)}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {trip.driver.firstName} {trip.driver.lastName[0]}. · {trip.vehicle.brand} {trip.vehicle.model}
          </AppText>
        </Card>
      ) : null}

      {booking.passengers && booking.passengers.length > 0 ? (
        <Card style={styles.card}>
          <AppText variant="base" weight="semibold" style={styles.cardTitle}>
            Passagers
          </AppText>
          {booking.passengers.map((passenger) => (
            <AppText key={passenger.id} variant="sm" color="textSecondary">
              {passenger.fullName}
            </AppText>
          ))}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.priceRow}>
          <AppText variant="sm" color="textSecondary">
            {booking.seatsCount} place{booking.seatsCount > 1 ? 's' : ''}
          </AppText>
          <AppText variant="sm">{formatMoney((Number(booking.pricePerSeat) * booking.seatsCount).toString())}</AppText>
        </View>
        <View style={styles.priceRow}>
          <AppText variant="sm" color="textSecondary">
            Frais de service
          </AppText>
          <AppText variant="sm">{formatMoney(booking.platformFee)}</AppText>
        </View>
        <Divider />
        <View style={styles.priceRow}>
          <AppText variant="base" weight="semibold">
            Total
          </AppText>
          <AppText variant="base" weight="semibold">
            {formatMoney(booking.totalAmount)}
          </AppText>
        </View>
      </Card>

      {booking.status === 'PENDING_PAYMENT' ? (
        <Button
          label="Payer maintenant"
          onPress={() => Alert.alert('Bientôt disponible', 'Le paiement en ligne arrive dans une prochaine mise à jour.')}
          style={styles.actionButton}
        />
      ) : null}

      {canCancel ? (
        <Button
          label="Annuler la réservation"
          variant="outline"
          onPress={handleCancel}
          loading={cancelBooking.isPending}
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
  statusBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    gap: 4,
    marginBottom: spacing.md,
  },
  cardTitle: {
    marginBottom: spacing.xxs,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  actionButton: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
});
