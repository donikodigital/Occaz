// mobile/src/components/screens/LocationPickerScreen.tsx
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

/**
 * Recherche d'adresse réelle (Mapbox, via le backend) en mode
 * principal — remplace la saisie 100% manuelle qui était le seul repli
 * disponible jusqu'ici (section 58, "Location hybride GPS + texte
 * libre"). La saisie manuelle reste accessible en repli explicite,
 * pour les adresses que la recherche ne couvre pas bien (zones rurales
 * moins bien cartographiées).
 */
export function LocationPickerScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [city, setCity] = useState<City | null>(null);
  const [addressLabel, setAddressLabel] = useState('');
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

  async function handleSearchSelect(suggestion: GeocodingSuggestion) {
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      const location = await locationsApi.create({
        label: suggestion.label,
        formattedAddress: suggestion.formattedAddress,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        geocodeTrust: 'EXACT',
      });
      selectLocation(location);
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      setSubmitting(false);
    }
  }

  async function handleManualSubmit() {
    setErrorMessage(undefined);
    if (!city) {
      setErrorMessage('Choisissez une ville.');
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
        geocodeTrust: 'MANUAL',
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

        {errorMessage ? (
          <AppText variant="sm" color="danger" style={styles.error}>
            {errorMessage}
          </AppText>
        ) : null}

        {!showManualEntry ? (
          <AppText
            variant="sm"
            color="primary"
            style={styles.manualToggle}
            onPress={() => setShowManualEntry(true)}
            suppressHighlighting
          >
            Adresse introuvable ? Saisir manuellement
          </AppText>
        ) : (
          <View style={styles.manualSection}>
            <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
              Ville
            </AppText>
            <Card
              onPress={() => {
                openCityPicker(CITY_PICKER_FIELD);
                router.push('/(customer)/select-city');
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

            <Button
              label="Valider l'adresse"
              onPress={handleManualSubmit}
              loading={isSubmitting}
              style={styles.submit}
            />
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
