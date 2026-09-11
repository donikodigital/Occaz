// mobile/app/(driver)/complete-profile.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconMapPin } from '@tabler/icons-react-native';
import { AppText, Button, Card, ScreenContainer, TextField } from '@/components/ui';
import { CountrySelectField } from '@/components/screens/CountrySelectField';
import { colors, spacing } from '@/theme';
import { useCreateDriverProfile } from '@/hooks/useDriverProfile';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { ApiError } from '@/services/api/ApiError';
import type { City, Country } from '@/types/geography.types';

const CITY_FIELD = 'driver-profile-city';

/**
 * Contrairement au profil client, countryId et cityId sont obligatoires
 * ici (DriverProfile, section 5) — un chauffeur opère depuis une ville
 * précise, contrairement à un client qui peut réserver depuis n'importe où.
 */
export default function DriverCompleteProfileScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const createProfile = useCreateDriverProfile();

  const citySelection = useCitySelectionStore((state) => state.selection);
  const consumeCitySelection = useCitySelectionStore((state) => state.consume);
  const openCityPicker = useCitySelectionStore((state) => state.openFor);

  useEffect(() => {
    if (citySelection?.field === CITY_FIELD) {
      setCity(citySelection.city);
      consumeCitySelection();
    }
  }, [citySelection, consumeCitySelection]);

  function handleSubmit() {
    setErrorMessage(undefined);
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setErrorMessage('Renseignez votre prénom et votre nom.');
      return;
    }
    if (!country || !city) {
      setErrorMessage('Choisissez votre pays et votre ville.');
      return;
    }

    createProfile.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        countryId: country.id,
        cityId: city.id,
        mobileMoneyNumber: mobileMoneyNumber.trim() || undefined,
      },
      {
        onSuccess: () => router.replace('/(driver)/(tabs)/home'),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <AppText variant="xxl" weight="semibold" style={styles.title}>
        Complétez votre profil
      </AppText>
      <AppText variant="base" color="textSecondary" style={styles.subtitle}>
        Ces informations sont nécessaires avant de pouvoir proposer des trajets.
      </AppText>

      <View style={styles.fields}>
        <TextField label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Mamadou" autoFocus />
        <TextField label="Nom" value={lastName} onChangeText={setLastName} placeholder="Barry" />

        <CountrySelectField label="Pays" value={country} onSelect={setCountry} />

        <View>
          <AppText variant="sm" weight="medium" color="textSecondary" style={styles.cityLabel}>
            Ville
          </AppText>
          <Card
            onPress={() => {
              openCityPicker(CITY_FIELD);
              router.push('/(driver)/select-city');
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
        </View>

        <TextField
          label="Numéro Mobile Money (optionnel)"
          value={mobileMoneyNumber}
          onChangeText={setMobileMoneyNumber}
          placeholder="+224620000000"
          keyboardType="phone-pad"
        />
      </View>

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button label="Continuer" onPress={handleSubmit} loading={createProfile.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },
  subtitle: {
    marginBottom: spacing.xl,
  },
  fields: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cityLabel: {
    marginBottom: spacing.xxs,
  },
  cityCard: {
    padding: spacing.sm + 2,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});
