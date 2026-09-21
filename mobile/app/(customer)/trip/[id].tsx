// mobile/app/(customer)/trip/[id].tsx
//
// v2 — Refonte bleu océan, sur le modèle de l'écran détail côté chauffeur :
//   - bandeau sombre avec la date, l'heure de départ et l'itinéraire en frise
//     verticale (adresse choisie quand elle existe, sinon la ville) ;
//   - carte « Chauffeur » (photo, badge vérifié, note, véhicule et plaque) ;
//   - carte « Détails » : places, colis acceptés, note du chauffeur ;
//   - pied de page fixe : le prix par place et « Réserver ».

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconCar,
  IconInfoCircle,
  IconMapPin,
  IconPackage,
  IconRosetteDiscountCheck,
  IconStarFilled,
  IconUser,
  IconUsers,
} from '@tabler/icons-react-native';
import { AppText, Avatar, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanHeroCard, OceanPill, OceanScreenHeader, OceanSection } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useTrip } from '@/hooks/useTripSearch';
import { formatMoney } from '@/utils/money';
import { formatDateLong, formatTime } from '@/utils/date';
import { formatSeatsAvailability } from '@/utils/seats';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, isLoading, isError } = useTrip(id);

  if (isLoading || !trip) {
    return (
      <ScreenContainer maxWidth="detail" style={styles.center}>
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

  const initials = `${trip.driver.firstName[0] ?? ''}${trip.driver.lastName[0] ?? ''}`;
  const isFull = trip.availableSeats <= 0;
  const originLabel = trip.originLocation?.label ?? trip.originCity.name;
  const destinationLabel = trip.destinationLocation?.label ?? trip.destinationCity.name;

  return (
    <ScreenContainer
      scroll
      maxWidth="detail"
      footer={
        <View style={styles.footer}>
          <View style={styles.footerPrice}>
            <AppText variant="xs" color="textSecondary">
              Prix par place
            </AppText>
            <AppText variant="lg" weight="bold" color={OCEAN.deep}>
              {formatMoney(trip.pricePerSeat)}
            </AppText>
          </View>
          <OceanButton
            label={isFull ? 'Complet' : 'Réserver'}
            onPress={() => router.push({ pathname: '/(customer)/booking/new', params: { tripId: trip.id } })}
            disabled={isFull}
            style={styles.reserveButton}
          />
        </View>
      }
    >
      <OceanScreenHeader title="Détail du trajet" onBack={() => router.back()} />

      <OceanHeroCard style={styles.hero}>
        <View style={styles.heroTop}>
          <OceanPill
            label={formatSeatsAvailability(trip.availableSeats)}
            tone={isFull ? 'neutral' : 'ocean'}
            icon={<IconUsers size={13} color={isFull ? colors.textSecondary : OCEAN.base} />}
          />
        </View>

        <View style={styles.when}>
          <AppText variant="sm" color={OCEAN.sky}>
            {capitalize(formatDateLong(trip.departureAt))}
          </AppText>
          <AppText variant="xxl" weight="bold" color={OCEAN.onDark}>
            {formatTime(trip.departureAt)}
          </AppText>
        </View>

        <View style={styles.route}>
          <View style={styles.rail}>
            <View style={styles.railDotStart} />
            <View style={styles.railLine} />
            <View style={styles.railDotEnd} />
          </View>
          <View style={styles.stops}>
            <View style={styles.stop}>
              <AppText variant="xs" color={OCEAN.sky}>
                Départ
              </AppText>
              <AppText variant="base" weight="bold" color={OCEAN.onDark} numberOfLines={2}>
                {originLabel}
              </AppText>
            </View>
            {trip.stops && trip.stops.length > 0
              ? trip.stops.map((stop) => (
                  <View key={stop.id} style={styles.stop}>
                    <AppText variant="xs" color={OCEAN.sky}>
                      Étape
                    </AppText>
                    <AppText variant="sm" color={OCEAN.onDark} numberOfLines={2}>
                      {stop.location?.label ?? 'Étape'}
                    </AppText>
                  </View>
                ))
              : null}
            <View style={styles.stop}>
              <AppText variant="xs" color={OCEAN.sky}>
                Arrivée
              </AppText>
              <AppText variant="base" weight="bold" color={OCEAN.onDark} numberOfLines={2}>
                {destinationLabel}
              </AppText>
            </View>
          </View>
        </View>
      </OceanHeroCard>

      <OceanSection icon={<IconUser size={17} color={OCEAN.base} />} title="Chauffeur">
        <View style={styles.driverRow}>
          <Avatar initials={initials} imageUri={trip.driver.photoUrl} size={52} />
          <View style={styles.driverText}>
            <View style={styles.nameRow}>
              <AppText variant="lg" weight="bold" numberOfLines={1} style={styles.nameText}>
                {trip.driver.firstName} {trip.driver.lastName}
              </AppText>
              {trip.driver.isVerifiedBadge ? <IconRosetteDiscountCheck size={17} color={OCEAN.base} /> : null}
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

        <View style={styles.vehicleBox}>
          <View style={styles.vehicleIcon}>
            <IconCar size={18} color={OCEAN.base} />
          </View>
          <View style={styles.vehicleText}>
            <AppText variant="sm" weight="semibold">
              {trip.vehicle.brand} {trip.vehicle.model}
            </AppText>
            <AppText variant="xs" color="textSecondary">
              {[trip.vehicle.color, trip.vehicle.plateNumber].filter(Boolean).join(' · ')}
            </AppText>
          </View>
        </View>
      </OceanSection>

      <OceanSection icon={<IconInfoCircle size={17} color={OCEAN.base} />} title="Détails">
        <View style={styles.pills}>
          <OceanPill label={`${trip.totalSeats} place${trip.totalSeats > 1 ? 's' : ''} au total`} icon={<IconUsers size={13} color={OCEAN.base} />} />
          {trip.allowsShipments ? (
            <OceanPill
              label={`Accepte les colis${trip.maxShipmentWeightKg ? ` · jusqu’à ${trip.maxShipmentWeightKg} kg` : ''}`}
              tone="success"
              icon={<IconPackage size={13} color={colors.successDark} />}
            />
          ) : null}
        </View>
        {trip.notes ? (
          <View style={styles.notes}>
            <IconMapPin size={16} color={OCEAN.base} />
            <AppText variant="sm" color="textSecondary" style={styles.notesText}>
              {trip.notes}
            </AppText>
          </View>
        ) : null}
      </OceanSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
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
  railDotStart: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: OCEAN.onDark,
  },
  railLine: {
    flex: 1,
    width: 2,
    minHeight: 24,
    marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  railDotEnd: {
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: OCEAN.gold,
  },
  stops: {
    flex: 1,
    gap: spacing.md,
  },
  stop: {
    gap: 2,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  driverText: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nameText: {
    flexShrink: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vehicleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OCEAN.line,
    backgroundColor: OCEAN.mist,
    padding: spacing.sm + 2,
  },
  vehicleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleText: {
    flex: 1,
    gap: 2,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  notes: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderRadius: 16,
    backgroundColor: OCEAN.mist,
    padding: spacing.sm + 2,
  },
  notesText: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    width: '100%',
  },
  footerPrice: {
    gap: 1,
  },
  reserveButton: {
    minWidth: 150,
  },
});