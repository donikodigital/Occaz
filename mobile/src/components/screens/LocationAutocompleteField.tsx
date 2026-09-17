// mobile/src/components/screens/LocationAutocompleteField.tsx
//
// Variante en ligne de LocationPickerScreen — même flux (recherche
// Mapbox -> confirmation de ville obligatoire -> création de la
// Location), mais intégrée directement dans un formulaire plutôt que
// sur un écran dédié. Utilisée uniquement dans la mise en page desktop
// de trip-new.tsx (voir useResponsive.ts) ; le parcours mobile continue
// de naviguer vers /(driver)/select-location, inchangé.
//
// `fieldKey` doit être unique par instance montée simultanément (ex :
// "trip-origin-city" / "trip-destination-city") — deux instances
// partagent le même useCitySelectionStore global ; une clé commune
// ferait que la sélection de ville de l'une soit captée par l'autre.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconMapPin, IconX } from '@tabler/icons-react-native';
import { AppText, Button, Card, TextField } from '@/components/ui';
import { LocationSearchField } from './LocationSearchField';
import { colors, spacing } from '@/theme';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { locationsApi } from '@/services/api/locations.api';
import { ApiError } from '@/services/api/ApiError';
import type { City } from '@/types/geography.types';
import type { GeocodingSuggestion } from '@/types/geocoding.types';
import type { TripLocation } from '@/types/trips.types';

export interface LocationAutocompleteFieldProps {
  basePath: '/(customer)' | '/(driver)';
  /** Unique par instance montée simultanément — voir note en tête de fichier. */
  fieldKey: string;
  label: string;
  value: TripLocation | null;
  onChange: (location: TripLocation | null) => void;
  placeholder?: string;
  countryCode?: string;
}

export function LocationAutocompleteField({
  basePath,
  fieldKey,
  label,
  value,
  onChange,
  placeholder,
  countryCode,
}: LocationAutocompleteFieldProps) {
  const [isEditing, setEditing] = useState(false);
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

  useEffect(() => {
    if (citySelection?.field === fieldKey) {
      setCity(citySelection.city);
      consumeCitySelection();
    }
  }, [citySelection, consumeCitySelection, fieldKey]);

  function handleSearchSelect(suggestion: GeocodingSuggestion) {
    setErrorMessage(undefined);
    setAddressLabel(suggestion.label);
    setGeocoded({
      formattedAddress: suggestion.formattedAddress,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setCity(null);
    setEditing(true);
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
      onChange(location);
      setEditing(false);
      setCity(null);
      setAddressLabel('');
      setGeocoded(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClear() {
    onChange(null);
    setEditing(false);
    setCity(null);
    setAddressLabel('');
    setGeocoded(null);
    setErrorMessage(undefined);
  }

  if (value && !isEditing) {
    return (
      <View style={styles.container}>
        {label ? (
          <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
            {label}
          </AppText>
        ) : null}
        <Card style={styles.valueCard}>
          <View style={styles.valueRow}>
            <IconMapPin size={16} color={colors.textSecondary} />
            <AppText variant="base" numberOfLines={1} style={{ flex: 1 }}>
              {value.label}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Modifier cette adresse"
              onPress={handleClear}
              hitSlop={8}
            >
              <IconX size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}

      {!isEditing ? (
        <LocationSearchField countryCode={countryCode} onSelect={handleSearchSelect} placeholder={placeholder} />
      ) : (
        <View style={styles.editSection}>
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
              openCityPicker(fieldKey);
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
            value={addressLabel}
            onChangeText={setAddressLabel}
            placeholder="Ex : Marché de Madina, près de l'arrêt taxi"
            style={styles.addressField}
          />

          {errorMessage ? (
            <AppText variant="sm" color="danger" style={styles.error}>
              {errorMessage}
            </AppText>
          ) : null}

          <View style={styles.editActions}>
            <Button label="Annuler" variant="secondary" fullWidth={false} onPress={handleClear} />
            <Button label="Valider" fullWidth={false} onPress={handleConfirm} loading={isSubmitting} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.xxs,
  },
  valueCard: {
    padding: spacing.sm + 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editSection: {
    marginTop: spacing.xs,
  },
  geocodedHint: {
    marginBottom: spacing.sm,
  },
  cityCard: {
    marginBottom: spacing.sm,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addressField: {
    marginBottom: spacing.sm,
  },
  error: {
    marginBottom: spacing.sm,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});