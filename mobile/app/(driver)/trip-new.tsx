// mobile/app/(driver)/trip-new.tsx
//
// v4.1 — Corrige une seule chose depuis v4 : IconButton n'accepte pas de
// prop `style` (volontairement, voir IconButtonProps). Le bouton
// d'inversion desktop est désormais enveloppé dans une View qui porte le
// marginTop, au lieu de passer style directement à IconButton. Rien
// d'autre ne change dans ce fichier.

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconArrowLeft,
  IconArrowsUpDown,
  IconCalendarEvent,
  IconCar,
  IconCheck,
  IconMapPin,
  IconMinus,
  IconPackage,
  IconPlus,
  IconRoute,
  IconUsers,
} from '@tabler/icons-react-native';
import {
  AppText,
  Button,
  CalendarPicker,
  Card,
  Divider,
  HoverCard,
  IconButton,
  RouteMap,
  ScreenContainer,
  TextField,
  TimePicker,
} from '@/components/ui';
import type { RouteInfo, RouteMapPoint, TimeValue } from '@/components/ui';
import { LocationAutocompleteField } from '@/components/screens/LocationAutocompleteField';
import { colors, radius, spacing } from '@/theme';
import { useMyVehicles } from '@/hooks/useVehicles';
import { useCurrencies } from '@/hooks/useCurrencies';
import { useCreateTrip } from '@/hooks/useDriverTrips';
import { useLocationSelectionStore } from '@/stores/locationSelectionStore';
import { useResponsive } from '@/hooks/useResponsive';
import { formatDateShort, formatTime, upcomingDays } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import type { TripLocation } from '@/types/trips.types';

const ORIGIN_CITY_FIELD = 'trip-origin-city';
const DESTINATION_CITY_FIELD = 'trip-destination-city';

function toRoutePoint(location: TripLocation | null): RouteMapPoint | null {
  if (!location || location.latitude == null || location.longitude == null) return null;
  return { latitude: location.latitude, longitude: location.longitude, label: location.label };
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>{icon}</View>
        <AppText variant="base" weight="semibold">
          {title}
        </AppText>
      </View>
      {children}
    </Card>
  );
}

export default function NewTripScreen() {
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<TripLocation | null>(null);
  const [destination, setDestination] = useState<TripLocation | null>(null);
  const [departureDate, setDepartureDate] = useState<Date>(() => upcomingDays(1)[0]);
  const [departureTime, setDepartureTime] = useState<TimeValue>({ hour: 8, minute: 0 });
  const [totalSeats, setTotalSeats] = useState(3);
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [currencyId, setCurrencyId] = useState<string | null>(null);
  const [allowsShipments, setAllowsShipments] = useState(true);
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const { data: vehicles } = useMyVehicles();
  const { data: currencies } = useCurrencies();
  const createTrip = useCreateTrip();
  const { isDesktop } = useResponsive();

  const locationSelection = useLocationSelectionStore((state) => state.selection);
  const consumeLocationSelection = useLocationSelectionStore((state) => state.consume);
  const openLocationPicker = useLocationSelectionStore((state) => state.openFor);

  React.useEffect(() => {
    if (!locationSelection) return;
    if (locationSelection.field === 'trip-origin') setOrigin(locationSelection.location);
    else if (locationSelection.field === 'trip-destination') setDestination(locationSelection.location);
    consumeLocationSelection();
  }, [locationSelection, consumeLocationSelection]);

  React.useEffect(() => {
    if (!currencyId && currencies && currencies.length > 0) setCurrencyId(currencies[0].id);
  }, [currencies, currencyId]);

  function openLocation(field: 'trip-origin' | 'trip-destination', title: string) {
    openLocationPicker(field);
    router.push({ pathname: '/(driver)/select-location', params: { title } });
  }

  function handleSwapLocations() {
    if (!origin || !destination) return;
    const previousOrigin = origin;
    setOrigin(destination);
    setDestination(previousOrigin);
  }

  const priceNumber = Number(pricePerSeat.replace(',', '.'));
  const hasValidPrice = Number.isFinite(priceNumber) && priceNumber > 0;
  const showRecap = Boolean(origin && destination && vehicleId && hasValidPrice);
  const selectedVehicle = vehicles?.find((v) => v.id === vehicleId);

  const departureAt = useMemo(() => {
    const date = new Date(departureDate);
    date.setHours(departureTime.hour, departureTime.minute, 0, 0);
    return date;
  }, [departureDate, departureTime]);

  function handleSubmit() {
    setErrorMessage(undefined);
    if (!vehicleId) {
      setErrorMessage('Choisissez un véhicule.');
      return;
    }
    if (!origin || !destination) {
      setErrorMessage('Renseignez le point de départ et la destination.');
      return;
    }
    if (!origin.cityId || !destination.cityId) {
      setErrorMessage('Les adresses doivent être rattachées à une ville.');
      return;
    }
    if (!hasValidPrice) {
      setErrorMessage('Indiquez le prix par place.');
      return;
    }
    if (!currencyId) {
      setErrorMessage('Choisissez une devise.');
      return;
    }

    createTrip.mutate(
      {
        vehicleId,
        originCityId: origin.cityId,
        originLocationId: origin.id,
        destinationCityId: destination.cityId,
        destinationLocationId: destination.id,
        departureAt: departureAt.toISOString(),
        totalSeats,
        pricePerSeat: String(Math.round(priceNumber)),
        currencyId,
        allowsShipments,
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: (trip) => router.replace(`/(driver)/trip/${trip.id}`),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer
      scroll
      maxWidth="content"
      footer={
        <View style={styles.footerContent}>
          {errorMessage ? (
            <AppText variant="sm" color="danger" style={styles.error}>
              {errorMessage}
            </AppText>
          ) : null}
          {showRecap ? (
            <View style={styles.recapCard}>
              <AppText variant="xs" weight="semibold" color="textSecondary" style={styles.recapEyebrow}>
                Récapitulatif
              </AppText>
              <AppText variant="base" weight="semibold" numberOfLines={1}>
                {origin!.label} → {destination!.label}
              </AppText>
              <AppText variant="sm" color="textSecondary">
                {formatDateShort(departureAt.toISOString())} à {formatTime(departureAt.toISOString())}
                {selectedVehicle ? ` · ${selectedVehicle.brand} ${selectedVehicle.model}` : ''}
              </AppText>
              <AppText variant="sm" color="textSecondary">
                {totalSeats} place{totalSeats > 1 ? 's' : ''} · {formatMoney(Math.round(priceNumber))} / place
                {routeInfo ? ` · ${routeInfo.distanceKm} km` : ''}
              </AppText>
            </View>
          ) : null}
          <Button label="Créer le trajet" onPress={handleSubmit} loading={createTrip.isPending} />
        </View>
      }
    >
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Créer un trajet
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.column, isDesktop && styles.columnLeft]}>
          <SectionCard icon={<IconRoute size={18} color={colors.primary} />} title="Itinéraire">
            {isDesktop ? (
              <View style={styles.desktopItinerary}>
                <View style={styles.itineraryRow}>
                  <View style={styles.inlineFieldsColumn}>
                    <LocationAutocompleteField
                      basePath="/(driver)"
                      fieldKey={ORIGIN_CITY_FIELD}
                      label="Point de départ"
                      value={origin}
                      onChange={setOrigin}
                      placeholder="Ex : Rond-point de Bambeto, Conakry"
                    />
                    <LocationAutocompleteField
                      basePath="/(driver)"
                      fieldKey={DESTINATION_CITY_FIELD}
                      label="Point d'arrivée"
                      value={destination}
                      onChange={setDestination}
                      placeholder="Ex : Rue 7x16, Labé"
                    />
                  </View>
                  <View style={styles.inlineSwap}>
                    <IconButton
                      icon={<IconArrowsUpDown size={16} color={colors.textPrimary} />}
                      accessibilityLabel="Inverser le départ et l'arrivée"
                      onPress={handleSwapLocations}
                      disabled={!origin || !destination}
                    />
                  </View>
                </View>
                <RouteMap
                  origin={toRoutePoint(origin)}
                  destination={toRoutePoint(destination)}
                  onRouteInfo={setRouteInfo}
                  height={260}
                />
              </View>
            ) : (
              <View style={styles.itineraryRow}>
                <Card style={styles.locationsCard}>
                  <Pressable onPress={() => openLocation('trip-origin', 'Point de départ')} style={styles.locationRow}>
                    <View style={styles.originDot} />
                    <AppText
                      variant="base"
                      color={origin ? 'textPrimary' : 'textSecondary'}
                      numberOfLines={1}
                      style={styles.locationText}
                    >
                      {origin?.label ?? 'Point de départ'}
                    </AppText>
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => openLocation('trip-destination', 'Destination')}
                    style={styles.locationRow}
                  >
                    <IconMapPin size={14} color={colors.accentDark} />
                    <AppText
                      variant="base"
                      color={destination ? 'textPrimary' : 'textSecondary'}
                      numberOfLines={1}
                      style={styles.locationText}
                    >
                      {destination?.label ?? 'Destination'}
                    </AppText>
                  </Pressable>
                </Card>
                <IconButton
                  icon={<IconArrowsUpDown size={16} color={colors.textPrimary} />}
                  accessibilityLabel="Inverser le départ et l'arrivée"
                  onPress={handleSwapLocations}
                  disabled={!origin || !destination}
                />
              </View>
            )}
          </SectionCard>

          <SectionCard icon={<IconCalendarEvent size={18} color={colors.primary} />} title="Date et heure">
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeColumn}>
                <CalendarPicker
                  label=""
                  selectedDate={departureDate}
                  onSelectDate={(date) => {
                    if (date) setDepartureDate(date);
                  }}
                />
              </View>
              <View style={styles.dateTimeColumn}>
                <TimePicker label="" value={departureTime} onChange={setDepartureTime} startHour={5} endHour={23} />
              </View>
            </View>
          </SectionCard>
        </View>

        <View style={[styles.column, isDesktop && styles.columnRight]}>
          <SectionCard icon={<IconCar size={18} color={colors.primary} />} title="Véhicule">
            {vehicles && vehicles.length > 0 ? (
              <View style={styles.vehicleRow}>
                {vehicles.map((vehicle) => {
                  const isActive = vehicle.id === vehicleId;
                  return (
                    <HoverCard
                      key={vehicle.id}
                      onPress={() => setVehicleId(vehicle.id)}
                      style={[styles.vehicleCard, isActive && styles.vehicleCardActive]}
                    >
                      <View style={styles.vehicleCardHeader}>
                        <IconCar size={18} color={isActive ? colors.primary : colors.textSecondary} />
                        {isActive ? <IconCheck size={16} color={colors.primary} /> : null}
                      </View>
                      <AppText variant="sm" weight="semibold" numberOfLines={1}>
                        {vehicle.brand} {vehicle.model}
                      </AppText>
                      <AppText variant="xs" color="textMuted">
                        {vehicle.plateNumber}
                      </AppText>
                    </HoverCard>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyVehicle}>
                <AppText variant="sm" color="textSecondary" style={styles.emptyVehicleText}>
                  Aucun véhicule enregistré.
                </AppText>
                <Button
                  label="Ajouter un véhicule"
                  variant="outline"
                  fullWidth={false}
                  onPress={() => router.push('/(driver)/vehicle-new')}
                />
              </View>
            )}
          </SectionCard>

          <SectionCard icon={<IconUsers size={18} color={colors.primary} />} title="Places et tarif">
            <View style={styles.fields}>
              <View style={styles.stepperBlock}>
                <AppText variant="sm" weight="medium" color="textSecondary">
                  Places proposées
                </AppText>
                <View style={styles.stepper}>
                  <IconButton
                    icon={<IconMinus size={16} color={colors.textPrimary} />}
                    accessibilityLabel="Retirer une place"
                    onPress={() => setTotalSeats((s) => Math.max(1, s - 1))}
                  />
                  <AppText variant="lg" weight="semibold" style={styles.stepperValue}>
                    {totalSeats}
                  </AppText>
                  <IconButton
                    icon={<IconPlus size={16} color={colors.textPrimary} />}
                    accessibilityLabel="Ajouter une place"
                    onPress={() => setTotalSeats((s) => Math.min(12, s + 1))}
                  />
                </View>
              </View>

              <View>
                <AppText variant="sm" weight="medium" color="textSecondary" style={styles.fieldLabel}>
                  Prix par place
                </AppText>
                <View style={styles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      value={pricePerSeat}
                      onChangeText={setPricePerSeat}
                      keyboardType="numeric"
                      placeholder="Ex : 50000"
                    />
                  </View>
                  {currencies && currencies.length > 1 ? (
                    <View style={styles.currencySegment}>
                      {currencies.map((currency, index) => {
                        const isActive = currency.id === currencyId;
                        return (
                          <Pressable
                            key={currency.id}
                            onPress={() => setCurrencyId(currency.id)}
                            style={[
                              styles.currencyOption,
                              index > 0 && styles.currencyOptionDivider,
                              isActive && styles.currencyOptionActive,
                            ]}
                          >
                            <AppText variant="xs" weight="semibold" color={isActive ? 'primary' : 'textSecondary'}>
                              {currency.isoCode}
                            </AppText>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              </View>

              <Pressable onPress={() => setAllowsShipments((v) => !v)} style={styles.switchRow}>
                <IconPackage size={16} color={colors.textSecondary} />
                <AppText variant="sm" style={styles.switchLabel}>
                  Accepter les colis sur ce trajet
                </AppText>
                <Switch
                  value={allowsShipments}
                  onValueChange={setAllowsShipments}
                  trackColor={{ true: colors.success, false: colors.border }}
                  thumbColor={colors.surface}
                />
              </Pressable>

              <TextField
                label="Notes (optionnel)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Informations complémentaires pour les passagers"
                multiline
                style={styles.notesField}
              />
            </View>
          </SectionCard>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  layout: {
    width: '100%',
  },
  layoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  column: {
    width: '100%',
  },
  columnLeft: {
    flex: 1.1,
  },
  columnRight: {
    flex: 0.9,
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  vehicleCard: {
    width: 136,
    gap: spacing.xxs,
  },
  vehicleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  vehicleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xxs,
  },
  emptyVehicle: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  emptyVehicleText: {
    marginBottom: spacing.xxs,
  },
  desktopItinerary: {
    gap: spacing.md,
  },
  itineraryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  inlineFieldsColumn: {
    flex: 1,
    gap: spacing.md,
  },
  inlineSwap: {
    marginTop: spacing.xl,
  },
  locationsCard: {
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  locationText: {
    flex: 1,
  },
  originDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateTimeColumn: {
    flex: 1,
  },
  fields: {
    gap: spacing.md,
  },
  stepperBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
  },
  fieldLabel: {
    marginBottom: spacing.xxs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.xs,
  },
  currencySegment: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  currencyOption: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  currencyOptionDivider: {
    borderLeftWidth: 1.5,
    borderLeftColor: colors.border,
  },
  currencyOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  switchLabel: {
    flex: 1,
  },
  notesField: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  footerContent: {
    width: '100%',
    gap: spacing.sm,
  },
  recapCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  recapEyebrow: {
    letterSpacing: 0.5,
  },
  error: {
    marginBottom: spacing.xxs,
  },
});