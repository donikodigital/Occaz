// mobile/src/components/screens/LocationPickerScreen.tsx
//
// v2 — Corrige deux bugs :
//  1. Une adresse choisie via la recherche Mapbox n'avait jamais de ville
//     rattachée (GeocodingSuggestion ne porte que label/adresse/lat/lng —
//     aucune info de ville, et City n'a pas de frontière géographique
//     stockée pour une résolution automatique). Après sélection, on
//     demande maintenant de confirmer la ville avant de créer la Location,
//     au lieu de la créer immédiatement sans cityId.
//  2. Le sélecteur de ville naviguait en dur vers /(customer)/select-city,
//     y compris quand cet écran est ouvert depuis le contexte chauffeur
//     (trip-new.tsx → /(driver)/select-location) — jamais remarqué côté
//     client, mais aurait cassé la navigation chauffeur. Paramétré via
//     `basePath`, même principe que ConversationsListScreen.tsx.
//
// IMPORTANT : les fichiers route qui montent cet écran
// (probablement mobile/app/(customer)/select-location.tsx et
// mobile/app/(driver)/select-location.tsx) doivent maintenant lui passer
// basePath="/(customer)" ou basePath="/(driver)" respectivement — envoie-
// les-moi si tu veux que je les corrige aussi, je ne les ai pas vus.

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconMapPin, IconX } from '@tabler/icons-react-native';
import { AppText, Button, Card, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { LocationSearchField } from './LocationSearchField';
import { colors, spacing } from '@/theme';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { useLocationSelectionStore } from '@/stores/locationSelectionStore';
import { locationsApi } from '@/services/api/locations.api';
import { ApiError } from '@/services/api/ApiError';
import type { City } from '@/types/geography.types';
import type { GeocodingSuggestion } from '@/types/geocoding.types';

const CITY_PICKER_FIELD = 'shipment-address-city';

export interface LocationPickerScreenProps {
  /** Racine de navigation du groupe appelant — (customer) et (driver) sont deux Stacks Expo Router isolés. */
  basePath: '/(customer)' | '/(driver)';
}

export function LocationPickerScreen({ basePath }: LocationPickerScreenProps) {
  const { title } = useLocalSearchParams<{ title?: string }>();
  const [showCityStep, setShowCityStep] = useState(false);
  const [city, setCity] = useState<City | null>(null);
  const [addressLabel, setAddressLabel] = useState('');
  const [geocoded, setGeocoded] = useState<{
    formattedAddress?: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const citySelection = useCitySelectionStore((state) => state.selection);
  const consumeCitySelection = useCitySelectionStore((state) => state.consume);
  const openCityPicker = useCitySelectionStore((state) => state.openFor);
  const selectLocation = useLocationSelectionStore((state) => state.select);

  useEffect(() => {
    if (citySelection?.field === CITY_PICKER_FIELD) {
      setCity(citySelection.city);
      consumeCitySelection();
    }
  }, [citySelection, consumeCitySelection]);

  function handleSearchSelect(suggestion: GeocodingSuggestion) {
    setErrorMessage(undefined);
    setAddressLabel(suggestion.label);
    setGeocoded({
      formattedAddress: suggestion.formattedAddress,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setShowCityStep(true);
  }

  async function handleConfirm() {
    setErrorMessage(undefined);
    if (!city) {
      setErrorMessage('Choisissez une ville pour confirmer cette adresse.');
      return;
    }
    if (addressLabel.trim().length < 3) {
      setErrorMessage("Précisez l'adresse (quartier, repère...).");
      return;
    }

    setSubmitting(true);
    try {
      const location = await locationsApi.create({
        label: addressLabel.trim(),
        cityId: city.id,
        ...(geocoded
          ? {
              formattedAddress: geocoded.formattedAddress,
              latitude: geocoded.latitude,
              longitude: geocoded.longitude,
              geocodeTrust: 'EXACT' as const,
            }
          : { geocodeTrust: 'MANUAL' as const }),
      });
      selectLocation(location);
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer scroll edges={['top', 'bottom']} maxWidth="form">
      <View style={styles.header}>
        <AppText variant="lg" weight="semibold">
          {title ?? 'Adresse'}
        </AppText>
        <IconButton
          icon={<IconX size={18} color={colors.textPrimary} />}
          accessibilityLabel="Fermer"
          onPress={() => router.back()}
        />
      </View>

      <View style={styles.body}>
        <LocationSearchField onSelect={handleSearchSelect} placeholder="Ex : Marché de Madina, Conakry" />

        {errorMessage && !showCityStep ? (
          <AppText variant="sm" color="danger" style={styles.error}>
            {errorMessage}
          </AppText>
        ) : null}

        {!showCityStep ? (
          <AppText
            variant="sm"
            color="primary"
            style={styles.manualToggle}
            onPress={() => setShowCityStep(true)}
            suppressHighlighting
          >
            Adresse introuvable ? Saisir manuellement
          </AppText>
        ) : (
          <View style={styles.manualSection}>
            {geocoded ? (
              <AppText variant="xs" color="textSecondary" style={styles.geocodedHint}>
                Confirmez la ville pour : {addressLabel}
              </AppText>
            ) : null}

            <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
              Ville
            </AppText>
            <Card
              onPress={() => {
                openCityPicker(CITY_PICKER_FIELD);
                router.push(`${basePath}/select-city`);
              }}
              style={styles.cityCard}
            >
              <View style={styles.cityRow}>
                <IconMapPin size={16} color={colors.textSecondary} />
                <AppText variant="base" color={city ? 'textPrimary' : 'textSecondary'}>
                  {city?.name ?? 'Choisir une ville'}
                </AppText>
              </View>
            </Card>

            <TextField
              label="Adresse précise"
              value={addressLabel}
              onChangeText={setAddressLabel}
              placeholder="Ex : Marché de Madina, près de l'arrêt taxi"
              multiline
              style={styles.addressField}
            />

            {errorMessage ? (
              <AppText variant="sm" color="danger" style={styles.error}>
                {errorMessage}
              </AppText>
            ) : null}

            <Button
              label="Valider l'adresse"
              onPress={handleConfirm}
              loading={isSubmitting}
              style={styles.submit}
            />

            {geocoded ? (
              <AppText
                variant="sm"
                color="textMuted"
                style={styles.manualToggle}
                onPress={() => {
                  setShowCityStep(false);
                  setGeocoded(null);
                  setAddressLabel('');
                }}
                suppressHighlighting
              >
                ← Refaire une recherche
              </AppText>
            ) : null}
          </View>
        )}
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
  body: {
    flex: 1,
  },
  label: {
    marginBottom: spacing.xxs,
  },
  manualToggle: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  geocodedHint: {
    marginBottom: spacing.sm,
  },
  manualSection: {
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  cityCard: {
    marginBottom: spacing.md,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressField: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    marginTop: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});