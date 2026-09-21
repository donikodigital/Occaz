// mobile/app/(customer)/edit-profile.tsx
//
// v5 — Habillage bleu océan (en-tête de retour, sections à en-tête
// soulignée, bouton plein). Logique inchangée : date de naissance en saisie
// manuelle JJ/MM/AAAA avec les slashs insérés pendant la frappe (pas de
// CalendarPicker : son usage ailleurs dans l'app suggère des dates
// futures uniquement — trip-new.tsx — pas adapté à une date de naissance).

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronRight, IconMapPin, IconUserCircle } from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { CountrySelectField } from '@/components/screens/CountrySelectField';
import { OceanButton, OceanCard, OceanScreenHeader, OceanSection } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCustomerProfile, useUpdateCustomerProfile } from '@/hooks/useCustomerProfile';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { ApiError } from '@/services/api/ApiError';
import type { City, Country } from '@/types/geography.types';

const CITY_FIELD = 'customer-edit-profile-city';

/** "19980412" -> "12/04/1998" — insère les slashs au fil de la frappe. */
function formatDateOfBirthInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  let result = day;
  if (month) result += `/${month}`;
  if (year) result += `/${year}`;
  return result;
}

/** "12/04/1998" -> "1998-04-12" (ISO, attendu par le backend) ou undefined si incomplet/invalide. */
function dateOfBirthToIso(display: string): string | undefined {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  // Rejette les dates que Date() accepterait en "roulant" (ex: 31/02 -> 03/03).
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() + 1 !== Number(month) ||
    date.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }
  if (date > new Date()) return undefined;
  return iso;
}

/** "1998-04-12T00:00:00.000Z" ou "1998-04-12" -> "12/04/1998" pour préremplir le champ. */
function isoToDateOfBirthDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const [year, month, day] = iso.slice(0, 10).split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

export default function EditProfileScreen() {
  const { data: profile } = useCustomerProfile();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(isoToDateOfBirthDisplay(profile?.dateOfBirth));
  const [country, setCountry] = useState<Country | null>(profile?.country ?? null);
  const [city, setCity] = useState<City | null>(profile?.city ?? null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const updateProfile = useUpdateCustomerProfile();

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

    let dateOfBirthIso: string | undefined;
    if (dateOfBirth.trim().length > 0) {
      dateOfBirthIso = dateOfBirthToIso(dateOfBirth.trim());
      if (!dateOfBirthIso) {
        setErrorMessage('Date de naissance invalide (format JJ/MM/AAAA).');
        return;
      }
    }

    updateProfile.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        countryId: country?.id,
        cityId: city?.id,
        address: address.trim() || undefined,
        ...(dateOfBirthIso ? { dateOfBirth: dateOfBirthIso } : {}),
      },
      {
        onSuccess: () => router.back(),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanScreenHeader title="Modifier le profil" subtitle="Compte client" onBack={() => router.back()} />

      <OceanSection icon={<IconUserCircle size={17} color={OCEAN.base} />} title="Identité">
        <TextField label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Fatoumata" />
        <TextField label="Nom" value={lastName} onChangeText={setLastName} placeholder="Diallo" />
        <TextField
          label="Date de naissance (optionnel)"
          value={dateOfBirth}
          onChangeText={(text) => setDateOfBirth(formatDateOfBirthInput(text))}
          placeholder="JJ/MM/AAAA"
          keyboardType="number-pad"
          maxLength={10}
        />
      </OceanSection>

      <OceanSection icon={<IconMapPin size={17} color={OCEAN.base} />} title="Localisation">
        <CountrySelectField label="Pays" value={country} onSelect={setCountry} />

        <View>
          <AppText variant="sm" weight="medium" color="textSecondary" style={styles.cityLabel}>
            Ville
          </AppText>
          <OceanCard
            onPress={() => {
              openCityPicker(CITY_FIELD);
              router.push('/(customer)/select-city');
            }}
            style={styles.cityCard}
            accessibilityLabel="Choisir une ville"
          >
            <View style={styles.cityIcon}>
              <IconMapPin size={16} color={OCEAN.base} />
            </View>
            <AppText variant="base" weight={city ? 'semibold' : 'medium'} color={city ? 'textPrimary' : 'textSecondary'} style={styles.cityText}>
              {city?.name ?? 'Choisir une ville'}
            </AppText>
            <IconChevronRight size={16} color={colors.textMuted} />
          </OceanCard>
        </View>

        <TextField
          label="Adresse (optionnel)"
          value={address}
          onChangeText={setAddress}
          placeholder="Ex : quartier, repère connu"
          multiline
          style={styles.addressField}
        />
      </OceanSection>

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <OceanButton label="Enregistrer" onPress={handleSubmit} loading={updateProfile.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cityLabel: {
    marginBottom: spacing.xxs,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
  },
  cityIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityText: {
    flex: 1,
  },
  addressField: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.lg,
  },
});