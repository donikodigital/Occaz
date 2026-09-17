// mobile/app/(driver)/trip-new.tsx
//
// v2 — Refonte visuelle : chaque section passe dans un panneau Card avec
// icône + titre (même principe que la page /geography du back-office),
// le nombre de places devient un stepper +/- (repris de vehicle-new.tsx)
// plutôt qu'un champ texte brut, et une carte récapitulative apparaît une
// fois le trajet complet, juste avant validation. Logique métier
// inchangée — seule la présentation évolue.
//
// NOTE : ne corrige pas encore l'erreur "adresses doivent être rattachées
// à une ville" — cause identifiée en amont (LocationPickerScreen ne
// renseigne jamais cityId sur le chemin recherche), correction à part.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconArrowLeft,
  IconCalendarEvent,
  IconCar,
  IconMapPin,
  IconMinus,
  IconPlus,
  IconRoute,
  IconUsers,
} from '@tabler/icons-react-native';
import { AppText, Button, CalendarPicker, Card, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useMyVehicles } from '@/hooks/useVehicles';
import { useCurrencies } from '@/hooks/useCurrencies';
import { useCreateTrip } from '@/hooks/useDriverTrips';
import { useLocationSelectionStore } from '@/stores/locationSelectionStore';
import { upcomingDays, formatDateShort, formatTime } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import type { TripLocation } from '@/types/trips.types';

const MINUTE_STEPS = [0, 15, 30, 45];

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
  const [selectedDay, setSelectedDay] = useState<Date>(upcomingDays(1)[0]);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [totalSeats, setTotalSeats] = useState(3);
  const [pricePerSeat, setPricePerSeat] = useState('');
  const [currencyId, setCurrencyId] = useState<string | null>(null);
  const [allowsShipments, setAllowsShipments] = useState(true);
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const { data: vehicles } = useMyVehicles();
  const { data: currencies } = useCurrencies();
  const createTrip = useCreateTrip();

  const locationSelection = useLocationSelectionStore((state) => state.selection);
  const consumeLocationSelection = useLocationSelectionStore((state) => state.consume);
  const openLocationPicker = useLocationSelectionStore((state) => state.openFor);

  useEffect(() => {
    if (!locationSelection) return;
    if (locationSelection.field === 'trip-origin') setOrigin(locationSelection.location);
    else if (locationSelection.field === 'trip-destination') setDestination(locationSelection.location);
    consumeLocationSelection();
  }, [locationSelection, consumeLocationSelection]);

  useEffect(() => {
    if (!currencyId && currencies && currencies.length > 0) setCurrencyId(currencies[0].id);
  }, [currencies, currencyId]);

  function openLocation(field: 'trip-origin' | 'trip-destination', title: string) {
    openLocationPicker(field);
    router.push({ pathname: '/(driver)/select-location', params: { title } });
  }

  const priceNumber = Number(pricePerSeat.replace(',', '.'));
  const hasValidPrice = Number.isFinite(priceNumber) && priceNumber > 0;
  const showRecap = Boolean(origin && destination && vehicleId && hasValidPrice);
  const selectedVehicle = vehicles?.find((v) => v.id === vehicleId);

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

    const departure = new Date(selectedDay);
    departure.setHours(hour, minute, 0, 0);

    createTrip.mutate(
      {
        vehicleId,
        originCityId: origin.cityId,
        originLocationId: origin.id,
        destinationCityId: destination.cityId,
        destinationLocationId: destination.id,
        departureAt: departure.toISOString(),
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
    <ScreenContainer scroll maxWidth="detail">
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

      <SectionCard icon={<IconCar size={18} color={colors.primary} />} title="Véhicule">
        <View style={styles.chipRow}>
          {(vehicles ?? []).map((vehicle) => {
            const isActive = vehicle.id === vehicleId;
            return (
              <Pressable
                key={vehicle.id}
                onPress={() => setVehicleId(vehicle.id)}
                style={[styles.chip, isActive && styles.chipActive]}
              >
                <AppText variant="sm" weight="medium" color={isActive ? colors.onPrimary : 'textPrimary'}>
                  {vehicle.brand} {vehicle.model}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      <SectionCard icon={<IconRoute size={18} color={colors.primary} />} title="Itinéraire">
        <Card style={styles.locationsCard} padded={false}>
          <Pressable onPress={() => openLocation('trip-origin', 'Point de départ')} style={styles.locationRow}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <AppText
              variant="base"
              color={origin ? 'textPrimary' : 'textSecondary'}
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {origin?.label ?? 'Point de départ'}
            </AppText>
          </Pressable>
          <View style={styles.locationDivider} />
          <Pressable onPress={() => openLocation('trip-destination', 'Destination')} style={styles.locationRow}>
            <IconMapPin size={14} color={colors.accentDark} />
            <AppText
              variant="base"
              color={destination ? 'textPrimary' : 'textSecondary'}
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {destination?.label ?? 'Destination'}
            </AppText>
          </Pressable>
        </Card>
      </SectionCard>

      <SectionCard icon={<IconCalendarEvent size={18} color={colors.primary} />} title="Date et heure">
        <View style={styles.dateField}>
          <CalendarPicker label="" selectedDate={selectedDay} onSelectDate={(date) => setSelectedDay(date ?? selectedDay)} />
        </View>

        <View style={styles.timeRow}>
          <View style={styles.timeGroup}>
            {[6, 8, 10, 12, 14, 16, 18, 20].map((h) => (
              <Pressable
                key={h}
                onPress={() => setHour(h)}
                style={[styles.timeChip, hour === h && styles.chipActive]}
              >
                <AppText variant="sm" weight="medium" color={hour === h ? colors.onPrimary : 'textPrimary'}>
                  {String(h).padStart(2, '0')}h
                </AppText>
              </Pressable>
            ))}
          </View>
          <View style={styles.timeGroup}>
            {MINUTE_STEPS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMinute(m)}
                style={[styles.timeChip, minute === m && styles.chipActive]}
              >
                <AppText variant="sm" weight="medium" color={minute === m ? colors.onPrimary : 'textPrimary'}>
                  {String(m).padStart(2, '0')}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      </SectionCard>

      <SectionCard icon={<IconUsers size={18} color={colors.primary} />} title="Places et tarif">
        <View style={styles.fields}>
          <View>
            <AppText variant="sm" weight="medium" color="textSecondary" style={styles.stepperLabel}>
              Nombre de places proposées
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

          <TextField
            label="Prix par place"
            value={pricePerSeat}
            onChangeText={setPricePerSeat}
            keyboardType="numeric"
            placeholder="Ex : 50000"
          />

          {currencies && currencies.length > 1 ? (
            <View style={styles.chipRow}>
              {currencies.map((currency) => {
                const isActive = currency.id === currencyId;
                return (
                  <Pressable
                    key={currency.id}
                    onPress={() => setCurrencyId(currency.id)}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <AppText variant="sm" weight="medium" color={isActive ? colors.onPrimary : 'textPrimary'}>
                      {currency.isoCode}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Pressable onPress={() => setAllowsShipments((v) => !v)} style={styles.switchRow}>
            <AppText variant="sm" style={{ flex: 1 }}>
              Accepter les colis sur ce trajet
            </AppText>
            <Switch
              value={allowsShipments}
              onValueChange={setAllowsShipments}
              trackColor={{ true: colors.success, false: colors.border }}
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

      {showRecap ? (
        <Card style={styles.recapCard}>
          <AppText variant="xs" weight="semibold" color="textMuted" style={styles.recapEyebrow}>
            RÉCAPITULATIF
          </AppText>
          <AppText variant="base" weight="semibold" numberOfLines={1}>
            {origin!.label} → {destination!.label}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {formatDateShort(
              new Date(new Date(selectedDay).setHours(hour, minute, 0, 0)).toISOString(),
            )}{' '}
            à {formatTime(new Date(new Date(selectedDay).setHours(hour, minute, 0, 0)).toISOString())}
            {selectedVehicle ? ` · ${selectedVehicle.brand} ${selectedVehicle.model}` : ''}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {totalSeats} place{totalSeats > 1 ? 's' : ''} · {formatMoney(Math.round(priceNumber))} / place
          </AppText>
        </Card>
      ) : null}

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button label="Créer le trajet" onPress={handleSubmit} loading={createTrip.isPending} style={styles.submit} />
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  locationsCard: {
    borderColor: colors.border,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  locationDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dateField: {
    marginBottom: spacing.md,
  },
  timeRow: {
    gap: spacing.xs,
  },
  timeGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  timeChip: {
    width: 46,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fields: {
    gap: spacing.md,
  },
  stepperLabel: {
    marginBottom: spacing.xxs,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notesField: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  recapCard: {
    gap: 4,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
    marginBottom: spacing.lg,
  },
  recapEyebrow: {
    letterSpacing: 0.5,
    marginBottom: spacing.xxs,
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});