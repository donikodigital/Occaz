// mobile/app/(customer)/trip-search.tsx
//
// v2 — Refonte bleu océan. L'itinéraire devient un tracé (rond creux au
// départ, rond plein à l'arrivée) avec un bouton d'inversion, comme sur
// l'écran « Envois disponibles » côté chauffeur ; la date et les passagers
// passent en sections à en-tête soulignée. Logique inchangée.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { IconArrowsUpDown, IconChevronRight, IconSearch, IconUsers, IconCalendarEvent } from '@tabler/icons-react-native';
import { AppText, CalendarPicker, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanScreenHeader, OceanSection, OceanStepper } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { recentSearchesStorage } from '@/services/storage/recentSearches';
import { locationsApi } from '@/services/api/locations.api';
import { toDateOnly } from '@/utils/date';
import type { City } from '@/types/geography.types';

/** Hauteur d'une ligne de l'itinéraire : le tracé est positionné à partir d'elle. */
const ROW_HEIGHT = 60;
const ROW_GAP = spacing.xs + 2;
const DOT = 12;

function RouteRow({
  index,
  label,
  value,
  placeholder,
  onPress,
}: {
  index: 0 | 1;
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value ?? placeholder}`}
      style={({ pressed }) => [
        styles.routeField,
        { top: index * (ROW_HEIGHT + ROW_GAP) },
        value ? styles.routeFieldActive : null,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.routeFieldText}>
        <AppText variant="xs" color="textMuted">
          {label}
        </AppText>
        <AppText variant="base" weight="semibold" color={value ? OCEAN.deep : 'textSecondary'} numberOfLines={1}>
          {value ?? placeholder}
        </AppText>
      </View>
      <IconChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function TripSearchScreen() {
  const [origin, setOrigin] = useState<City | null>(null);
  const [destination, setDestination] = useState<City | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [passengersCount, setPassengersCount] = useState(1);

  const selection = useCitySelectionStore((state) => state.selection);
  const consumeSelection = useCitySelectionStore((state) => state.consume);
  const openCityPicker = useCitySelectionStore((state) => state.openFor);
  const [isDetectingOrigin, setIsDetectingOrigin] = useState(false);

  useEffect(() => {
    if (!selection) return;
    if (selection.field === 'origin') setOrigin(selection.city);
    else setDestination(selection.city);
    consumeSelection();
  }, [selection, consumeSelection]);

  // Détecte automatiquement la ville de départ via le GPS à l'ouverture de
  // l'écran. Purement en confort : en cas de permission refusée, de GPS
  // indisponible, ou de position hors zone couverte, on échoue en
  // silence — le champ reste à saisir/choisir normalement, comme avant
  // cette fonctionnalité. `originRef` évite d'écraser un choix que
  // l'utilisateur aurait fait pendant que la détection était en cours.
  const originRef = useRef(origin);
  originRef.current = origin;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsDetectingOrigin(true);
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted || cancelled) return;

        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) return;

        const { city } = await locationsApi.resolveCity({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (city && !cancelled && !originRef.current) setOrigin(city);
      } catch {
        // Échec silencieux — voir commentaire ci-dessus.
      } finally {
        if (!cancelled) setIsDetectingOrigin(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  function pickCity(field: 'origin' | 'destination') {
    openCityPicker(field);
    router.push('/(customer)/select-city');
  }

  const firstDotTop = ROW_HEIGHT / 2 - DOT / 2;
  const secondDotTop = ROW_HEIGHT + ROW_GAP + ROW_HEIGHT / 2 - DOT / 2;

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Rechercher un trajet" subtitle="Où allez-vous ?" onBack={() => router.back()} />

      <OceanCard style={styles.routeCard}>
        <View style={[styles.routeBox, { height: ROW_HEIGHT * 2 + ROW_GAP }]}>
          <View style={[styles.railDot, styles.railDotStart, { top: firstDotTop }]} />
          <View style={[styles.railLine, { top: firstDotTop + DOT, height: secondDotTop - firstDotTop - DOT }]} />
          <View style={[styles.railDot, styles.railDotEnd, { top: secondDotTop }]} />

          <RouteRow
            index={0}
            label="Départ"
            value={origin?.name}
            placeholder={isDetectingOrigin ? 'Détection de votre position…' : 'Ville de départ'}
            onPress={() => pickCity('origin')}
          />
          <RouteRow
            index={1}
            label="Arrivée"
            value={destination?.name}
            placeholder="Ville d’arrivée"
            onPress={() => pickCity('destination')}
          />

          {origin || destination ? (
            <Pressable
              onPress={swapCities}
              accessibilityRole="button"
              accessibilityLabel="Inverser les villes"
              style={({ pressed }) => [styles.swapButton, pressed && styles.pressed]}
            >
              <IconArrowsUpDown size={16} color={OCEAN.base} />
            </Pressable>
          ) : null}
        </View>
      </OceanCard>

      <OceanSection icon={<IconCalendarEvent size={17} color={OCEAN.base} />} title="Date">
        <CalendarPicker label="" selectedDate={selectedDate} onSelectDate={setSelectedDate} flexibleLabel="Dates flexibles" />
      </OceanSection>

      <OceanSection icon={<IconUsers size={17} color={OCEAN.base} />} title="Passagers">
        <View style={styles.passengersRow}>
          <View style={styles.passengersText}>
            <AppText variant="sm" weight="semibold">
              Nombre de places
            </AppText>
            <AppText variant="xs" color="textSecondary">
              Pour vous et les personnes qui voyagent avec vous.
            </AppText>
          </View>
          <OceanStepper value={passengersCount} onChange={setPassengersCount} min={1} max={8} label="passager" />
        </View>
      </OceanSection>

      <OceanButton
        label="Rechercher"
        icon={<IconSearch size={18} color={OCEAN.onDark} />}
        onPress={handleSearch}
        disabled={!canSearch}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  routeCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  routeBox: {
    position: 'relative',
  },
  railDot: {
    position: 'absolute',
    left: 2,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  railDotStart: {
    borderWidth: 2,
    borderColor: OCEAN.base,
    backgroundColor: colors.surface,
  },
  railDotEnd: {
    backgroundColor: OCEAN.base,
  },
  railLine: {
    position: 'absolute',
    left: 7,
    width: 2,
    backgroundColor: OCEAN.line,
  },
  routeField: {
    position: 'absolute',
    left: 26,
    right: 0,
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.sm + 2,
    paddingRight: spacing.sm + 2,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: OCEAN.line,
    backgroundColor: colors.surface,
  },
  routeFieldActive: {
    borderColor: OCEAN.base,
    backgroundColor: OCEAN.mist,
  },
  routeFieldText: {
    flex: 1,
    gap: 2,
    paddingRight: 34,
  },
  swapButton: {
    position: 'absolute',
    right: 14,
    top: ROW_HEIGHT + ROW_GAP / 2 - 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: OCEAN.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  passengersText: {
    flex: 1,
    gap: 2,
  },
  submit: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
});