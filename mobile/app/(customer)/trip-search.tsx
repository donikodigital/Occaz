import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowLeft, IconArrowsUpDown, IconMapPin, IconMinus, IconPlus } from '@tabler/icons-react-native';
import { AppText, Button, CalendarPicker, Card, IconButton, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { recentSearchesStorage } from '@/services/storage/recentSearches';
import { toDateOnly } from '@/utils/date';
import type { City } from '@/types/geography.types';

export default function TripSearchScreen() {
  const [origin, setOrigin] = useState<City | null>(null);
  const [destination, setDestination] = useState<City | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [passengersCount, setPassengersCount] = useState(1);

  const selection = useCitySelectionStore((state) => state.selection);
  const consumeSelection = useCitySelectionStore((state) => state.consume);
  const openCityPicker = useCitySelectionStore((state) => state.openFor);

  useEffect(() => {
    if (!selection) return;
    if (selection.field === 'origin') setOrigin(selection.city);
    else setDestination(selection.city);
    consumeSelection();
  }, [selection, consumeSelection]);

  const canSearch = Boolean(origin && destination);

  async function handleSearch() {
    if (!origin || !destination) return;

    await recentSearchesStorage.add({
      originCityId: origin.id,
      originCityName: origin.name,
      destinationCityId: destination.id,
      destinationCityName: destination.name,
      searchedAt: new Date().toISOString(),
    });

    router.push({
      pathname: '/(customer)/trip-results',
      params: {
        originCityId: origin.id,
        originCityName: origin.name,
        destinationCityId: destination.id,
        destinationCityName: destination.name,
        departureDate: selectedDate ? toDateOnly(selectedDate) : undefined,
        passengersCount: String(passengersCount),
      },
    });
  }

  function swapCities() {
    setOrigin(destination);
    setDestination(origin);
  }

  return (
    <ScreenContainer maxWidth="detail">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Rechercher un trajet
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <Card style={styles.citiesCard} padded={false}>
        <Pressable
          onPress={() => {
            openCityPicker('origin');
            router.push('/(customer)/select-city');
          }}
          style={styles.cityRow}
        >
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <AppText variant="base" color={origin ? 'textPrimary' : 'textSecondary'}>
            {origin?.name ?? 'Ville de départ'}
          </AppText>
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          onPress={() => {
            openCityPicker('destination');
            router.push('/(customer)/select-city');
          }}
          style={styles.cityRow}
        >
          <IconMapPin size={14} color={colors.accentDark} />
          <AppText variant="base" color={destination ? 'textPrimary' : 'textSecondary'}>
            {destination?.name ?? 'Où allez-vous ?'}
          </AppText>
        </Pressable>

        {origin || destination ? (
          <Pressable onPress={swapCities} style={styles.swapButton} accessibilityLabel="Inverser les villes">
            <IconArrowsUpDown size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </Card>

      <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
        Date
      </AppText>
      <View style={styles.dateField}>
        <CalendarPicker
          label=""
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          flexibleLabel="Dates flexibles"
        />
      </View>

      <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
        Passagers
      </AppText>
      <View style={styles.stepper}>
        <IconButton
          icon={<IconMinus size={16} color={colors.textPrimary} />}
          accessibilityLabel="Retirer un passager"
          onPress={() => setPassengersCount((c) => Math.max(1, c - 1))}
        />
        <AppText variant="lg" weight="semibold" style={styles.stepperValue}>
          {passengersCount}
        </AppText>
        <IconButton
          icon={<IconPlus size={16} color={colors.textPrimary} />}
          accessibilityLabel="Ajouter un passager"
          onPress={() => setPassengersCount((c) => Math.min(8, c + 1))}
        />
      </View>

      <Button label="Rechercher" onPress={handleSearch} disabled={!canSearch} style={styles.submit} />
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
  citiesCard: {
    marginBottom: spacing.lg,
    position: 'relative',
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  swapButton: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  dateField: {
    marginBottom: spacing.lg,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
  },
  submit: {
    marginBottom: spacing.md,
  },
});