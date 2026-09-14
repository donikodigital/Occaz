// mobile/app/(driver)/complete-profile.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconMapPin } from '@tabler/icons-react-native';
import { AppText, Button, Card, DocumentUploadField, ProfilePhotoField, ScreenContainer, TextField } from '@/components/ui';
import { CountrySelectField } from '@/components/screens/CountrySelectField';
import { colors, spacing } from '@/theme';
import { useCreateDriverProfile } from '@/hooks/useDriverProfile';
import { useDriverDocumentUpload, useMyDriverDocuments } from '@/hooks/useDriverDocuments';
import { useDriverPhotoUpload } from '@/hooks/useDriverPhotoUpload';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { ApiError } from '@/services/api/ApiError';
import type { City, Country } from '@/types/geography.types';

const CITY_FIELD = 'driver-profile-city';

/** Deuxième étape affichée juste après la création du profil — mêmes principes que VehicleDocumentsStep dans vehicle-new.tsx. */
function IdentityDocumentsStep({ firstName, lastName }: { firstName: string; lastName: string }) {
  const { data: documents } = useMyDriverDocuments();
  const upload = useDriverDocumentUpload();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoUpload = useDriverPhotoUpload((profile) => setPhotoUrl(profile.photoUrl));

  const nationalIdDoc = documents?.find((d) => d.type === 'national_id');
  const licenseDoc = documents?.find((d) => d.type === 'driver_license');
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`;

  return (
    <ScreenContainer scroll maxWidth="form">
      <AppText variant="xxl" weight="semibold" style={styles.title}>
        Vos pièces d&apos;identité
      </AppText>
      <AppText variant="base" color="textSecondary" style={styles.subtitle}>
        Envoyez votre photo de profil, votre CNI et votre permis de conduire pour que votre compte soit validé.
      </AppText>

      <ProfilePhotoField
        photoUrl={photoUrl}
        initials={initials}
        isUploading={photoUpload.isUploading}
        onPickLibrary={photoUpload.pickFromLibrary}
        onPickCamera={photoUpload.pickFromCamera}
        isRequired
      />

      <View style={styles.fields}>
        <DocumentUploadField
          label="Carte nationale d'identité"
          document={nationalIdDoc}
          isUploading={upload.isUploading}
          onPickLibrary={() => upload.pickFromLibrary('national_id')}
          onPickCamera={() => upload.pickFromCamera('national_id')}
        />
        <DocumentUploadField
          label="Permis de conduire"
          document={licenseDoc}
          isUploading={upload.isUploading}
          onPickLibrary={() => upload.pickFromLibrary('driver_license')}
          onPickCamera={() => upload.pickFromCamera('driver_license')}
        />
      </View>

      <Button label="Continuer" onPress={() => router.replace('/(driver)/(tabs)/home')} style={styles.submit} />
    </ScreenContainer>
  );
}

/**
 * Contrairement au profil client, countryId et cityId sont obligatoires
 * ici (DriverProfile, section 5) — un chauffeur opère depuis une ville
 * précise, contrairement à un client qui peut réserver depuis n'importe où.
 */
export default function DriverCompleteProfileScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isProfileCreated, setProfileCreated] = useState(false);
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

  if (isProfileCreated) {
    return <IdentityDocumentsStep firstName={firstName} lastName={lastName} />;
  }

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
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Adresse email invalide.');
      return;
    }

    createProfile.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: trimmedEmail || undefined,
        countryId: country.id,
        cityId: city.id,
        mobileMoneyNumber: mobileMoneyNumber.trim() || undefined,
      },
      {
        onSuccess: () => setProfileCreated(true),
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
        <TextField
          label="Email (optionnel)"
          value={email}
          onChangeText={setEmail}
          placeholder="vous@exemple.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <AppText variant="xs" color="textMuted">
          Pour recevoir aussi vos notifications par email.
        </AppText>

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
