// mobile/app/(customer)/trip/[id].tsx
//
// v2 — Refonte bleu océan, sur le modèle de l'écran détail côté chauffeur :
//   - bandeau sombre avec la date, l'heure de départ et l'itinéraire en frise
//     verticale (adresse choisie quand elle existe, sinon la ville) ;
//   - carte « Chauffeur » (photo, badge vérifié, note, véhicule et plaque) ;
//   - carte « Détails » : places, colis acceptés, note du chauffeur ;
//   - pied de page fixe : le prix par place et « Réserver ».
// [04/10/2026] v4 — Choix de la ville de montée et de descente : sur un trajet qui traverse des villes, le client choisit où il
// monte et où il descend (puces) ; le prix, l'heure et les places s'adaptent. Utile surtout après une recherche sans ville de
// départ, où le tronçon proposé part du départ du conducteur.
// [03/10/2026] v3 — Villes traversées : le tronçon choisi dans la recherche (ex. Kindia → Labé) donne le prix, l'heure de
// passage et la frise ; les étapes du conducteur sont listées avec leur heure de passage, celles du client en évidence.

import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconCar,
  IconArrowsSplit2,
  IconInfoCircle,
  IconMapPin,
  IconPackage,
  IconRosetteDiscountCheck,
  IconStarFilled,
  IconUser,
  IconUsers,
} from '@tabler/icons-react-native';
import { AppText, Avatar, ScreenContainer } from '@/components/ui';
import {
  OceanButton,
  OceanChip,
  OceanHeroCard,
  OceanPill,
  OceanScreenHeader,
  OceanSection,
} from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useTrip } from '@/hooks/useTripSearch';
import { formatMoney } from '@/utils/money';
import { formatDateLong, formatTime } from '@/utils/date';
import { formatSeatsAvailability } from '@/utils/seats';
import { routePointOptions, segmentAvailableSeats, stopAddress } from '@/utils/tripSegment';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    boardingStopId?: string;
    alightingStopId?: string;
  }>();
  const { id } = params;
  // Tronçon choisi : celui de la recherche au départ, puis modifiable ici (undefined = départ / arrivée du trajet).
  const [boardingStopId, setBoardingStopId] = useState<string | undefined>(params.boardingStopId || undefined);
  const [alightingStopId, setAlightingStopId] = useState<string | undefined>(params.alightingStopId || undefined);
  const {
    data: trip,
    isLoading,
    isError,
    isPlaceholderData: isSwitchingSegment,
  } = useTrip(id, { boardingStopId, alightingStopId }, { keepPrevious: true });

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
  // Places libres sur le tronçon du client (pas sur le trajet entier).
  const seats = segmentAvailableSeats(trip);
  const isFull = seats <= 0;
  const originLabel = trip.originLocation?.label ?? trip.originCity.name;
  const destinationLabel = trip.destinationLocation?.label ?? trip.destinationCity.name;
  const segment = trip.segment;
  const isPartial = Boolean(segment && !segment.isFullTrip);
  const boardingAt = segment?.boardingAt ?? trip.departureAt;

  // Points où l'on peut monter / descendre. Le client ne peut monter qu'avant son point de descente, et descendre qu'après sa montée.
  const routeOptions = routePointOptions(trip);
  const boardingIndex = boardingStopId ? Math.max(0, routeOptions.findIndex((p) => p.stopId === boardingStopId)) : 0;
  const alightingIndex = alightingStopId
    ? Math.max(1, routeOptions.findIndex((p) => p.stopId === alightingStopId))
    : routeOptions.length - 1;

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
              {formatMoney(trip.customerPricePerSeat ?? trip.pricePerSeat)}
            </AppText>
          </View>
          <OceanButton
            label={isFull ? 'Complet' : 'Réserver'}
            onPress={() =>
              router.push({
                pathname: '/(customer)/booking/new',
                params: {
                  tripId: trip.id,
                  ...(boardingStopId ? { boardingStopId } : {}),
                  ...(alightingStopId ? { alightingStopId } : {}),
                },
              })
            }
            // Pas de réservation tant que le prix du nouveau tronçon n'est pas chargé : on ne réserve jamais sur un prix périmé.
            disabled={isFull || isSwitchingSegment}
            style={styles.reserveButton}
          />
        </View>
      }
    >
      <OceanScreenHeader title="Détail du trajet" onBack={() => router.back()} />

      <OceanHeroCard style={styles.hero}>
        <View style={styles.heroTop}>
          <OceanPill
            label={formatSeatsAvailability(seats)}
            tone={isFull ? 'neutral' : 'ocean'}
            icon={<IconUsers size={13} color={isFull ? colors.textSecondary : OCEAN.base} />}
          />
        </View>

        <View style={styles.when}>
          <AppText variant="sm" color={OCEAN.sky}>
            {capitalize(formatDateLong(boardingAt))}
          </AppText>
          <AppText variant="xxl" weight="bold" color={OCEAN.onDark}>
            {formatTime(boardingAt)}
          </AppText>
          {isPartial && segment ? (
            <AppText variant="sm" color={OCEAN.onDark}>
              Vous montez à {segment.boardingCityName ?? 'votre étape'} et descendez à {segment.alightingCityName ?? 'votre arrivée'}
            </AppText>
          ) : null}
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
              ? trip.stops.map((stop) => {
                  const isMine = stop.id === segment?.boardingStopId || stop.id === segment?.alightingStopId;
                  return (
                    <View key={stop.id} style={styles.stop}>
                      <AppText variant="xs" color={OCEAN.sky}>
                        {stop.id === segment?.boardingStopId
                          ? 'Votre montée'
                          : stop.id === segment?.alightingStopId
                            ? 'Votre descente'
                            : 'Étape'}
                        {stop.estimatedArrivalAt ? ` · vers ${formatTime(stop.estimatedArrivalAt)}` : ''}
                      </AppText>
                      <AppText variant="sm" weight={isMine ? 'bold' : 'regular'} color={OCEAN.onDark} numberOfLines={2}>
                        {stopAddress(stop)}
                      </AppText>
                    </View>
                  );
                })
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

      {routeOptions.length > 2 ? (
        <OceanSection icon={<IconArrowsSplit2 size={17} color={OCEAN.base} />} title="Votre trajet">
          <AppText variant="xs" color="textSecondary">
            Le conducteur traverse plusieurs villes : montez et descendez où vous voulez sur sa route, le prix s'adapte.
          </AppText>
          <View style={styles.choiceBlock}>
            <AppText variant="sm" weight="medium" color="textSecondary">
              Je monte à
            </AppText>
            <View style={styles.choiceRow}>
              {routeOptions.slice(0, alightingIndex).map((point, index) => (
                <OceanChip
                  key={`up-${point.stopId ?? point.kind}`}
                  label={`${point.cityName}${point.at ? ` · ${formatTime(point.at)}` : ''}`}
                  active={index === boardingIndex}
                  onPress={() => setBoardingStopId(point.stopId ?? undefined)}
                />
              ))}
            </View>
          </View>
          <View style={styles.choiceBlock}>
            <AppText variant="sm" weight="medium" color="textSecondary">
              Je descends à
            </AppText>
            <View style={styles.choiceRow}>
              {routeOptions.slice(boardingIndex + 1).map((point, offset) => (
                <OceanChip
                  key={`down-${point.stopId ?? point.kind}`}
                  label={point.cityName}
                  active={boardingIndex + 1 + offset === alightingIndex}
                  onPress={() => setAlightingStopId(point.stopId ?? undefined)}
                />
              ))}
            </View>
          </View>
        </OceanSection>
      ) : null}

      <OceanSection icon={<IconUser size={17} color={OCEAN.base} />} title="Chauffeur">
        <View style={styles.driverRow}>
          <Avatar initials={initials} imageUri={trip.driver.photoUrl} size={52} />
          <View style={styles.driverText}>
            <View style={styles.nameRow}>
              <AppText variant="lg" weight="bold" numberOfLines={1} style={styles.nameText}>
                {trip.driver.firstName} {trip.driver.lastName}
              </AppText>
              {trip.driver.isVerifiedBadge ? (
                <IconRosetteDiscountCheck size={17} color={OCEAN.base} />
              ) : (
                <OceanPill label="Non vérifié" tone="neutral" />
              )}
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
  choiceBlock: {
    gap: spacing.xs,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});