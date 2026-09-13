import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowLeft, IconMapPin } from '@tabler/icons-react-native';
import { AppText, Button, CalendarPicker, Card, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useMyVehicles } from '@/hooks/useVehicles';
import { useCurrencies } from '@/hooks/useCurrencies';
import { useCreateTrip } from '@/hooks/useDriverTrips';
import { useLocationSelectionStore } from '@/stores/locationSelectionStore';
import { upcomingDays } from '@/utils/date';
import { ApiError } from '@/services/api/ApiError';
import type { TripLocation } from '@/types/trips.types';

const MINUTE_STEPS = [0, 15, 30, 45];

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
    const price = Number(pricePerSeat.replace(',', '.'));
    if (!Number.isFinite(price) || price <= 0) {
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
        pricePerSeat: String(Math.round(price)),
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

      <SectionTitle label="Véhicule" />
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

      <SectionTitle label="Itinéraire" />
      <Card style={styles.locationsCard} padded={false}>
        <Pressable onPress={() => openLocation('trip-origin', 'Point de départ')} style={styles.locationRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <AppText variant="base" color={origin ? 'textPrimary' : 'textSecondary'} numberOfLines={1} style={{ flex: 1 }}>
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

      <SectionTitle label="Date de départ" />
      <View style={styles.dateField}>
        <CalendarPicker label="" selectedDate={selectedDay} onSelectDate={(date) => setSelectedDay(date ?? selectedDay)} />
      </View>

      <SectionTitle label="Heure de départ" />
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

      <SectionTitle label="Places et tarif" />
      <View style={styles.fields}>
        <TextField
          label="Nombre de places proposées"
          value={String(totalSeats)}
          onChangeText={(t) => setTotalSeats(Math.max(1, Number(t.replace(/\D/g, '')) || 1))}
          keyboardType="number-pad"
        />
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

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button label="Créer le trajet" onPress={handleSubmit} loading={createTrip.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
      {label}
    </AppText>
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
  sectionTitle: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.lg,
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
    marginBottom: spacing.lg,
  },
  timeRow: {
    gap: spacing.xs,
    marginBottom: spacing.lg,
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
    marginBottom: spacing.lg,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notesField: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});