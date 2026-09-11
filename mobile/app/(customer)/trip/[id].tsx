// mobile/app/(customer)/trip/[id].tsx
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconArrowLeft,
  IconCar,
  IconClock,
  IconMapPin,
  IconPackage,
  IconRosetteDiscountCheck,
  IconStarFilled,
} from '@tabler/icons-react-native';
import { AppText, Avatar, Badge, Button, Card, Divider, IconButton } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useTrip } from '@/hooks/useTripSearch';
import { formatMoney } from '@/utils/money';
import { formatDateLong, formatTime } from '@/utils/date';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, isLoading, isError } = useTrip(id);

  if (isLoading || !trip) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        {isError ? (
          <AppText variant="sm" color="danger">
            Impossible de charger ce trajet.
          </AppText>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </SafeAreaView>
    );
  }

  const initials = `${trip.driver.firstName[0] ?? ''}${trip.driver.lastName[0] ?? ''}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.driverCard}>
          <View style={styles.driverRow}>
            <Avatar initials={initials} imageUri={trip.driver.photoUrl} size={52} />
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <AppText variant="lg" weight="semibold">
                  {trip.driver.firstName} {trip.driver.lastName}
                </AppText>
                {trip.driver.isVerifiedBadge ? (
                  <IconRosetteDiscountCheck size={16} color={colors.successDark} />
                ) : null}
              </View>
              {trip.driver.averageRating ? (
                <View style={styles.ratingRow}>
                  <IconStarFilled size={13} color={colors.accent} />
                  <AppText variant="sm" color="textSecondary">
                    {trip.driver.averageRating.toFixed(1)} · {trip.driver.completedTripsCount} trajets effectués
                  </AppText>
                </View>
              ) : (
                <AppText variant="sm" color="textSecondary">
                  Nouveau chauffeur
                </AppText>
              )}
            </View>
          </View>

          <Divider />

          <View style={styles.vehicleRow}>
            <IconCar size={18} color={colors.textSecondary} />
            <AppText variant="sm" color="textSecondary">
              {trip.vehicle.brand} {trip.vehicle.model} · {trip.vehicle.color ?? '—'} ·{' '}
              {trip.vehicle.plateNumber}
            </AppText>
          </View>
        </Card>

        <Card style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <View style={{ flex: 1 }}>
              <AppText variant="xs" color="textSecondary">
                Départ
              </AppText>
              <AppText variant="base" weight="medium">
                {trip.originLocation?.label ?? trip.originCity.name}
              </AppText>
            </View>
          </View>

          {trip.stops && trip.stops.length > 0
            ? trip.stops.map((stop) => (
                <View key={stop.id} style={styles.routeRow}>
                  <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
                  <AppText variant="sm" color="textSecondary">
                    {stop.location?.label ?? 'Étape'}
                  </AppText>
                </View>
              ))
            : null}

          <View style={styles.routeRow}>
            <IconMapPin size={12} color={colors.accentDark} />
            <View style={{ flex: 1 }}>
              <AppText variant="xs" color="textSecondary">
                Arrivée
              </AppText>
              <AppText variant="base" weight="medium">
                {trip.destinationLocation?.label ?? trip.destinationCity.name}
              </AppText>
            </View>
          </View>

          <Divider />

          <View style={styles.metaRow}>
            <IconClock size={14} color={colors.textSecondary} />
            <AppText variant="sm" color="textSecondary">
              {formatDateLong(trip.departureAt)} à {formatTime(trip.departureAt)}
            </AppText>
          </View>

          {trip.allowsShipments ? (
            <View style={styles.metaRow}>
              <IconPackage size={14} color={colors.successDark} />
              <AppText variant="sm" color="success">
                Accepte les colis{trip.maxShipmentWeightKg ? ` (jusqu'à ${trip.maxShipmentWeightKg} kg)` : ''}
              </AppText>
            </View>
          ) : null}
        </Card>

        {trip.notes ? (
          <Card style={styles.notesCard}>
            <AppText variant="sm" color="textSecondary">
              {trip.notes}
            </AppText>
          </Card>
        ) : null}

        <View style={styles.priceSummary}>
          <AppText variant="base" color="textSecondary">
            Prix par place
          </AppText>
          <AppText variant="xxl" weight="semibold">
            {formatMoney(trip.pricePerSeat)}
          </AppText>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Badge
          label={`${trip.availableSeats} place${trip.availableSeats > 1 ? 's' : ''} disponible${trip.availableSeats > 1 ? 's' : ''}`}
          tone="primary"
        />
        <Button
          label="Réserver"
          onPress={() => router.push({ pathname: '/(customer)/booking/new', params: { tripId: trip.id } })}
          disabled={trip.availableSeats === 0}
          fullWidth={false}
          style={styles.reserveButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  driverCard: {
    gap: spacing.sm,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  routeCard: {
    gap: spacing.sm + 2,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  notesCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surfaceMuted,
  },
  priceSummary: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reserveButton: {
    minWidth: 140,
  },
});
