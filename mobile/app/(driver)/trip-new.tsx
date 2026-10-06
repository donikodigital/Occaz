// mobile/app/(driver)/trip-new.tsx
//
// [04/10/2026] v6 — Formulaire en 4 étapes repliables (Itinéraire, Date et heure, Véhicule, Places et tarif) : une seule étape
// ouverte à la fois, les autres tiennent sur une ligne avec leur résumé. Les villes traversées et les notes sont des détails
// repliés. L'aperçu bleu disparaît sur téléphone (les résumés disent la même chose), il reste sur grand écran. La devise n'est plus
// un choix : c'est celle du pays de la ville de départ (Sénégal → XOF, Guinée → GNF), imposée aussi par le serveur.
// [04/10/2026] v5.1 — Adresses claires : sous chaque adresse (départ, arrivée, villes traversées, aperçu), la ville et le pays
// s'affichent (« Kindia, Guinée »). Deux adresses de même nom dans deux villes ne se confondent plus.
// [03/10/2026] v5 — « Villes traversées » : le conducteur ajoute les villes où il passe (Kindia, Mamou…) pour que les
// clients de ces villes trouvent et réservent son trajet. Les étapes sont rangées dans l'ordre de la route (distance
// depuis le départ) ; leurs prix sont calculés automatiquement par le serveur et se modifient sur l'écran du trajet,
// avant la publication.
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
  IconX,
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
import { Disclosure, FormAccordionSection, StepProgress, animateNextLayout, type StepStatus } from '@/components/screens/FormAccordion';
import { OceanButton } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useMyVehicles } from '@/hooks/useVehicles';
import { useCurrencies } from '@/hooks/useCurrencies';
import { useCity, useCountries } from '@/hooks/useCities';
import { useCreateTrip } from '@/hooks/useDriverTrips';
import { useLocationSelectionStore } from '@/stores/locationSelectionStore';
import { useResponsive } from '@/hooks/useResponsive';
import { formatDateLong, formatTime, upcomingDays } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { sortByDistanceFrom } from '@/utils/routeOrder';
import { FLOW_DONE_PARAM } from '@/utils/navigation';
import { formatCityCountry } from '@/utils/shipmentDisplay';
import { ApiError } from '@/services/api/ApiError';
import type { TripLocation } from '@/types/trips.types';

type SectionKey = 'route' | 'date' | 'vehicle' | 'price';
const SECTION_ORDER: SectionKey[] = ['route', 'date', 'vehicle', 'price'];

const ORIGIN_CITY_FIELD = 'trip-origin-city';
const DESTINATION_CITY_FIELD = 'trip-destination-city';

function toRoutePoint(location: TripLocation | null): RouteMapPoint | null {
  if (!location || location.latitude == null || location.longitude == null) return null;
  return { latitude: location.latitude, longitude: location.longitude, label: location.label };
}

const HERO_MUTED = OCEAN.sky;

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function PreviewStop({ eyebrow, label, place }: { eyebrow: string; label?: string; place?: string | null }) {
  return (
    <View style={styles.previewStop}>
      <AppText variant="xs" color={HERO_MUTED}>
        {eyebrow}
      </AppText>
      <AppText variant="lg" weight="bold" color={label ? colors.onPrimary : HERO_MUTED} numberOfLines={1}>
        {label ?? 'À choisir'}
      </AppText>
      {place ? (
        <AppText variant="xs" color={HERO_MUTED} numberOfLines={1}>
          {place}
        </AppText>
      ) : null}
    </View>
  );
}

/** Adresse sur une ligne et, dessous, « Ville, Pays » : on sait toujours dans quelle ville se trouve le lieu. */
function LocationRowText({ location, placeholder }: { location: TripLocation | null; placeholder: string }) {
  const place = formatCityCountry(location);
  return (
    <View style={styles.locationText}>
      <AppText variant="base" color={location ? 'textPrimary' : 'textSecondary'} numberOfLines={1}>
        {location?.label ?? placeholder}
      </AppText>
      {place ? (
        <AppText variant="xs" color="textSecondary" numberOfLines={1}>
          {place}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * Même langage visuel que le billet de l'écran "Détail du trajet"
 * (bandeau bleu, cercles décoratifs, rail départ/arrivée) — mais ici un
 * aperçu qui se construit en direct pendant que le formulaire se
 * remplit, jamais un vrai billet (pas de perforation/coupon détachable,
 * qui suggérerait un trajet déjà publié).
 */
function LivePreviewHero({
  origin,
  destination,
  departureAt,
  totalSeats,
  priceLabel,
}: {
  origin: TripLocation | null;
  destination: TripLocation | null;
  departureAt: Date;
  totalSeats: number;
  priceLabel: string | null;
}) {
  return (
    <View style={styles.previewCard}>
      <View style={styles.previewDecoLarge} />
      <View style={styles.previewDecoSmall} />

      <View style={styles.previewPill}>
        <AppText variant="xs" weight="semibold" color={colors.onPrimary}>
          Aperçu du trajet
        </AppText>
      </View>

      <View style={styles.previewWhen}>
        <AppText variant="sm" color={HERO_MUTED}>
          {capitalize(formatDateLong(departureAt.toISOString()))}
        </AppText>
        <AppText variant="xxl" weight="bold" color={colors.onPrimary}>
          {formatTime(departureAt.toISOString())}
        </AppText>
      </View>

      <View style={styles.previewRoute}>
        <View style={styles.previewRail}>
          <View style={styles.previewRailDotOrigin} />
          <View style={styles.previewRailLine} />
          <View style={styles.previewRailDotDestination} />
        </View>
        <View style={styles.previewStops}>
          <PreviewStop eyebrow="Départ" label={origin?.label} place={formatCityCountry(origin)} />
          <PreviewStop eyebrow="Arrivée" label={destination?.label} place={formatCityCountry(destination)} />
        </View>
      </View>

      <View style={styles.previewFooterRow}>
        <View>
          <AppText variant="xs" color={HERO_MUTED}>
            Places
          </AppText>
          <AppText variant="md" weight="bold" color={colors.onPrimary}>
            {totalSeats}
          </AppText>
        </View>
        <View style={styles.previewFooterDivider} />
        <View>
          <AppText variant="xs" color={HERO_MUTED}>
            Prix par place
          </AppText>
          <AppText variant="md" weight="bold" color={colors.onPrimary}>
            {priceLabel ?? '—'}
          </AppText>
        </View>
      </View>
    </View>
  );
}

export default function NewTripScreen() {
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<TripLocation | null>(null);
  const [destination, setDestination] = useState<TripLocation | null>(null);
  const [stops, setStops] = useState<TripLocation[]>([]);
  const [stopFieldKey, setStopFieldKey] = useState(0);
  const [departureDate, setDepartureDate] = useState<Date>(() => upcomingDays(1)[0]);
  const [departureTime, setDepartureTime] = useState<TimeValue>({ hour: 8, minute: 0 });
  const [totalSeats, setTotalSeats] = useState(3);
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [allowsShipments, setAllowsShipments] = useState(true);
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  // Étape ouverte (une seule à la fois sur téléphone), étape en erreur, et date/heure confirmées (la date par défaut est
  // « demain 8 h » : le conducteur doit la regarder, pas la valider sans la voir).
  const [openSection, setOpenSection] = useState<SectionKey | null>('route');
  const [errorSection, setErrorSection] = useState<SectionKey | undefined>();
  const [dateConfirmed, setDateConfirmed] = useState(false);

  const { data: vehicles } = useMyVehicles();
  const { data: currencies } = useCurrencies();
  const { data: originCity } = useCity(origin?.cityId ?? null);
  const { data: countries } = useCountries();
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

  // Devise = celle du pays de la ville de DÉPART : c'est là que le passager monte et paie. Plus de choix à faire (ni de risque de se
  // tromper) ; le serveur applique la même règle. La conversion vers le portefeuille du conducteur, s'il est dans une autre devise,
  // se fait déjà au crédit (ExchangeRateService).
  const originCountry = useMemo(
    () => (originCity && countries ? countries.find((item) => item.id === originCity.countryId) : undefined),
    [originCity, countries],
  );
  const currency = useMemo(
    () =>
      originCountry?.defaultCurrencyId && currencies
        ? (currencies.find((item) => item.id === originCountry.defaultCurrencyId) ?? null)
        : null,
    [originCountry, currencies],
  );

  // Un seul véhicule enregistré : il est retenu d'office (un geste de moins).
  React.useEffect(() => {
    if (!vehicleId && vehicles && vehicles.length === 1) setVehicleId(vehicles[0].id);
  }, [vehicles, vehicleId]);

  function openLocation(field: 'trip-origin' | 'trip-destination', title: string) {
    openLocationPicker(field);
    router.push({ pathname: '/(driver)/select-location', params: { title } });
  }

  function handleSwapLocations() {
    if (!origin || !destination) return;
    const previousOrigin = origin;
    setOrigin(destination);
    setDestination(previousOrigin);
    // La route est inversée : l'ordre de passage des villes traversées aussi.
  }

  function handleAddStop(location: TripLocation | null) {
    if (!location) return;
    setErrorMessage(undefined);
    setErrorSection(undefined);
    if (!location.cityId) {
      fail('route', 'Choisissez une adresse située dans la ville traversée.');
    } else if (location.cityId === origin?.cityId || location.cityId === destination?.cityId) {
      fail('route', "Une ville traversée ne peut pas être la ville de départ ou d'arrivée.");
    } else if (stops.some((stop) => stop.cityId === location.cityId)) {
      fail('route', 'Cette ville est déjà dans la liste.');
    } else {
      setStops((current) => [...current, location]);
    }
    // Remet le champ à zéro pour ajouter une autre ville.
    setStopFieldKey((value) => value + 1);
  }

  function handleRemoveStop(locationId: string) {
    setStops((current) => current.filter((stop) => stop.id !== locationId));
  }

  // Villes traversées rangées dans l'ordre de la route : de la plus proche du départ à la plus éloignée.
  const orderedStops = useMemo(() => sortByDistanceFrom(origin, stops), [stops, origin]);

  const priceNumber = Number(pricePerSeat.replace(',', '.'));
  const hasValidPrice = Number.isFinite(priceNumber) && priceNumber > 0;
  const showRecap = Boolean(origin && destination && vehicleId && hasValidPrice);
  const selectedVehicle = vehicles?.find((v) => v.id === vehicleId);

  const departureAt = useMemo(() => {
    const date = new Date(departureDate);
    date.setHours(departureTime.hour, departureTime.minute, 0, 0);
    return date;
  }, [departureDate, departureTime]);

  const routeDone = Boolean(origin && destination && origin.cityId && destination.cityId);
  const vehicleDone = vehicleId !== null;
  const priceDone = hasValidPrice;
  const done: Record<SectionKey, boolean> = { route: routeDone, date: dateConfirmed, vehicle: vehicleDone, price: priceDone };
  const doneCount = SECTION_ORDER.filter((key) => done[key]).length;
  const statusOf = (key: SectionKey): StepStatus =>
    done[key] ? 'done' : errorSection === key && errorMessage ? 'error' : 'todo';

  function toggleSection(key: SectionKey) {
    animateNextLayout();
    setOpenSection((current) => (current === key ? null : key));
  }

  function goToNextSection(from: SectionKey) {
    animateNextLayout();
    if (from === 'date') setDateConfirmed(true);
    setOpenSection(SECTION_ORDER[SECTION_ORDER.indexOf(from) + 1] ?? null);
  }

  /** Erreur de validation : ouvre l'étape concernée pour que le conducteur voie tout de suite quoi corriger. */
  function fail(section: SectionKey, message: string) {
    animateNextLayout();
    setOpenSection(section);
    setErrorSection(section);
    setErrorMessage(message);
  }

  function handleSubmit() {
    setErrorMessage(undefined);
    setErrorSection(undefined);

    // Dans l'ordre des étapes : la première à corriger s'ouvre.
    if (!origin || !destination) {
      fail('route', 'Renseignez le point de départ et la destination.');
      return;
    }
    if (!origin.cityId || !destination.cityId) {
      fail('route', 'Les adresses doivent être rattachées à une ville.');
      return;
    }
    if (orderedStops.some((stop) => stop.cityId === origin.cityId || stop.cityId === destination.cityId)) {
      fail('route', "Une ville traversée ne peut pas être la ville de départ ou d'arrivée.");
      return;
    }
    if (!vehicleId) {
      fail('vehicle', 'Choisissez un véhicule.');
      return;
    }
    if (!hasValidPrice) {
      fail('price', 'Indiquez le prix par place.');
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
        // Pas de devise envoyée : le serveur applique celle du pays de départ.
        allowsShipments,
        notes: notes.trim() || undefined,
        stops:
          orderedStops.length > 0
            ? orderedStops.map((stop, index) => ({ locationId: stop.id, sequence: index + 1 }))
            : undefined,
      },
      {
        onSuccess: (trip) => router.replace({ pathname: '/(driver)/trip/[id]', params: { id: trip.id, ...FLOW_DONE_PARAM } }),
        onError: (error) => {
          setErrorSection(undefined);
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  // Sur grand écran, les deux colonnes restent visibles : toutes les étapes sont ouvertes. Sur téléphone, une seule à la fois.
  const isOpen = (key: SectionKey) => isDesktop || openSection === key;
  const toggle = (key: SectionKey) => (isDesktop ? undefined : toggleSection(key));
  const nextButton = (key: SectionKey, label = 'Continuer', disabled = false) =>
    isDesktop ? null : <OceanButton label={label} variant="soft" disabled={disabled} onPress={() => goToNextSection(key)} />;

  const priceUnit = currency?.isoCode;
  const summaries: Record<SectionKey, string> = {
    route:
      origin && destination
        ? `${origin.city?.name ?? origin.label} → ${destination.city?.name ?? destination.label}${
            orderedStops.length > 0 ? ` · ${orderedStops.length} ville${orderedStops.length > 1 ? 's' : ''} traversée${orderedStops.length > 1 ? 's' : ''}` : ''
          }`
        : 'Départ et arrivée à choisir',
    date: `${formatDateLong(departureAt.toISOString())} · ${formatTime(departureAt.toISOString())}`,
    vehicle: selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model} · ${selectedVehicle.plateNumber}` : 'Véhicule à choisir',
    price: hasValidPrice
      ? `${totalSeats} place${totalSeats > 1 ? 's' : ''} · ${formatMoney(Math.round(priceNumber), priceUnit ?? '')}`
      : `${totalSeats} place${totalSeats > 1 ? 's' : ''} · prix à indiquer`,
  };

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
          {showRecap && selectedVehicle ? (
            <View style={styles.recapCard}>
              <AppText variant="xs" weight="semibold" color="textSecondary" style={styles.recapEyebrow}>
                {selectedVehicle.brand} {selectedVehicle.model}
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

      {isDesktop ? (
        <View style={styles.previewWrap}>
          <LivePreviewHero
            origin={origin}
            destination={destination}
            departureAt={departureAt}
            totalSeats={totalSeats}
            priceLabel={hasValidPrice ? formatMoney(Math.round(priceNumber), priceUnit ?? '') : null}
          />
        </View>
      ) : (
        <StepProgress done={doneCount} total={SECTION_ORDER.length} />
      )}

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.column, isDesktop && styles.columnLeft]}>
          {/* 1 — Itinéraire : départ et arrivée d'abord ; les villes traversées, repliées */}
          <FormAccordionSection
            step={1}
            icon={<IconRoute size={15} color={colors.primary} />}
            title="Itinéraire"
            summary={summaries.route}
            status={statusOf('route')}
            expanded={isOpen('route')}
            onToggle={() => toggle('route')}
          >
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
                    <LocationRowText location={origin} placeholder="Point de départ" />
                  </Pressable>
                  <Divider />
                  <Pressable
                    onPress={() => openLocation('trip-destination', 'Destination')}
                    style={styles.locationRow}
                  >
                    <IconMapPin size={14} color={colors.accentDark} />
                    <LocationRowText location={destination} placeholder="Destination" />
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

            <Disclosure
              icon={<IconMapPin size={15} color={OCEAN.base} />}
              label="Villes traversées (facultatif)"
              preview={
                orderedStops.length > 0
                  ? orderedStops.map((stop) => stop.city?.name ?? stop.label).join(' · ')
                  : 'Ajoutez les villes où vous passez'
              }
              defaultExpanded={isDesktop}
            >
              <AppText variant="sm" color="textSecondary">
                Les clients qui y habitent pourront trouver votre trajet et monter ou descendre chez eux. Les prix sont
                calculés automatiquement ; vous pourrez les modifier avant de publier.
              </AppText>
              {orderedStops.map((stop, index) => (
                <View key={stop.id} style={styles.stopRow}>
                  <View style={styles.stopBadge}>
                    <AppText variant="xs" weight="bold" color="primary">
                      {index + 1}
                    </AppText>
                  </View>
                  <View style={styles.stopLabel}>
                    <AppText variant="sm" weight="semibold" numberOfLines={1}>
                      {stop.label}
                    </AppText>
                    {formatCityCountry(stop) ? (
                      <AppText variant="xs" color="textSecondary" numberOfLines={1}>
                        {formatCityCountry(stop)}
                      </AppText>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer ${stop.label}`}
                    onPress={() => handleRemoveStop(stop.id)}
                    hitSlop={8}
                  >
                    <IconX size={18} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ))}
              <LocationAutocompleteField
                key={stopFieldKey}
                label=""
                value={null}
                onChange={handleAddStop}
                placeholder="Ajouter une ville traversée (ex. Kindia)"
              />
            </Disclosure>

            {nextButton('route', 'Continuer', !routeDone)}
          </FormAccordionSection>

          {/* 2 — Date et heure */}
          <FormAccordionSection
            step={2}
            icon={<IconCalendarEvent size={15} color={colors.primary} />}
            title="Date et heure"
            summary={summaries.date}
            status={statusOf('date')}
            expanded={isOpen('date')}
            onToggle={() => toggle('date')}
          >
            <View style={styles.dateTimeRow}>
              <View style={styles.dateTimeColumn}>
                <CalendarPicker
                  label=""
                  selectedDate={departureDate}
                  onSelectDate={(date) => {
                    if (date) {
                      setDepartureDate(date);
                      setDateConfirmed(true);
                    }
                  }}
                />
              </View>
              <View style={styles.dateTimeColumn}>
                <TimePicker
                  label=""
                  value={departureTime}
                  onChange={(value) => {
                    setDepartureTime(value);
                    setDateConfirmed(true);
                  }}
                  startHour={5}
                  endHour={23}
                />
              </View>
            </View>
            {nextButton('date')}
          </FormAccordionSection>
        </View>

        <View style={[styles.column, isDesktop && styles.columnRight]}>
          {/* 3 — Véhicule */}
          <FormAccordionSection
            step={3}
            icon={<IconCar size={15} color={colors.primary} />}
            title="Véhicule"
            summary={summaries.vehicle}
            status={statusOf('vehicle')}
            expanded={isOpen('vehicle')}
            onToggle={() => toggle('vehicle')}
          >
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
            {nextButton('vehicle', 'Continuer', !vehicleDone)}
          </FormAccordionSection>

          {/* 4 — Places et tarif : l'essentiel d'abord ; les notes, repliées */}
          <FormAccordionSection
            step={4}
            icon={<IconUsers size={15} color={colors.primary} />}
            title="Places et tarif"
            summary={summaries.price}
            status={statusOf('price')}
            expanded={isOpen('price')}
            onToggle={() => toggle('price')}
          >
            <View style={styles.fields}>
              <View style={styles.stepperBlock}>
                <AppText variant="sm" weight="medium" color="textSecondary">
                  Places proposées
                </AppText>
                <View style={styles.stepper}>
                  <IconButton
                    icon={<IconMinus size={16} color={colors.textPrimary} />}
                    accessibilityLabel="Retirer une place"
                    onPress={() => setTotalSeats((value) => Math.max(1, value - 1))}
                  />
                  <AppText variant="lg" weight="semibold" style={styles.stepperValue}>
                    {totalSeats}
                  </AppText>
                  <IconButton
                    icon={<IconPlus size={16} color={colors.textPrimary} />}
                    accessibilityLabel="Ajouter une place"
                    onPress={() => setTotalSeats((value) => Math.min(12, value + 1))}
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
                  {/* Devise imposée par le pays de départ : un repère, pas un choix. */}
                  {currency ? (
                    <View style={styles.currencyBadge} accessibilityLabel={`Devise : ${currency.isoCode}`}>
                      <AppText variant="sm" weight="semibold" color="primary">
                        {currency.isoCode}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                <AppText variant="xs" color="textMuted" style={styles.currencyHint}>
                  {currency
                    ? `Devise du pays de départ${originCountry ? ` (${originCountry.name})` : ''}.`
                    : 'La devise est celle du pays de départ : choisissez d’abord le départ.'}
                </AppText>
              </View>

              <Pressable onPress={() => setAllowsShipments((value) => !value)} style={styles.switchRow}>
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

              <Disclosure
                icon={<IconPackage size={15} color={OCEAN.base} />}
                label="Notes pour les passagers (optionnel)"
                preview={notes.trim() ? notes.trim() : 'Informations complémentaires'}
                defaultExpanded={isDesktop}
              >
                <TextField
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Informations complémentaires pour les passagers"
                  multiline
                  style={styles.notesField}
                />
              </Disclosure>
            </View>
          </FormAccordionSection>
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
  previewWrap: {
    marginBottom: spacing.lg,
  },
  previewCard: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: OCEAN.deep,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  previewDecoLarge: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  previewDecoSmall: {
    position: 'absolute',
    bottom: -40,
    left: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  previewPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  previewWhen: {
    gap: 2,
  },
  previewRoute: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  previewRail: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  previewRailDotOrigin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.onPrimary,
  },
  previewRailLine: {
    flex: 1,
    width: 2,
    minHeight: 24,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginVertical: 4,
  },
  previewRailDotDestination: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.onPrimary,
  },
  previewStops: {
    flex: 1,
    justifyContent: 'space-between',
  },
  previewStop: {
    gap: 1,
  },
  previewFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  previewFooterDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  stopBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
  },
  stopLabel: {
    flex: 1,
  },
  currencyBadge: {
    minWidth: 56,
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyHint: {
    marginTop: spacing.xs,
  },
});