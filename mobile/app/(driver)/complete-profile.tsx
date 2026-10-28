// mobile/app/(driver)/complete-profile.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [19/10/2026] v+ — bouton « Retour » en haut de l'écran (vers l'espace passager si le compte en a un, sinon vers l'écran précédent).
// [19/10/2026] v+ — reprend nom, pays et ville du profil passager quand un passager devient conducteur ; l'étape des pièces rappelle le délai de régularisation.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowLeft, IconMapPin } from '@tabler/icons-react-native';
import { AppText, Button, Card, DocumentUploadField, IconButton, ProfilePhotoField, ScreenContainer, TextField } from '@/components/ui';
import { CountrySelectField } from '@/components/screens/CountrySelectField';
import { colors, spacing } from '@/theme';
import { useCreateDriverProfile } from '@/hooks/useDriverProfile';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useProfileStepBack } from '@/hooks/useProfileStepBack';
import { useDriverDocumentUpload, useMyDriverDocuments } from '@/hooks/useDriverDocuments';
import { useDriverPhotoUpload } from '@/hooks/useDriverPhotoUpload';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { useAuthStore } from '@/stores/authStore';
import { useAuthFlowStore } from '@/stores/authFlowStore';
import { ApiError } from '@/services/api/ApiError';
import type { City, Country } from '@/types/geography.types';
import { useT } from '@/i18n';

const CITY_FIELD = 'driver-profile-city';

/** Deuxième étape affichée juste après la création du profil — mêmes principes que VehicleDocumentsStep dans vehicle-new.tsx. */
function IdentityDocumentsStep({ firstName, lastName }: { firstName: string; lastName: string }) {
  const t = useT();
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
        {t("Vos pièces d'identité")}
      </AppText>
      <AppText variant="base" color="textSecondary" style={styles.subtitle}>
        {t('Envoyez votre photo de profil, votre CNI et votre permis de conduire pour que votre compte soit validé. Vous pouvez créer des trajets de passagers dès maintenant, mais les pièces doivent être envoyées dans la semaine : vous recevrez des rappels tous les 2 jours.')}
      </AppText>

      <ProfilePhotoField
        photoUrl={photoUrl}
        initials={initials}
        isUploading={photoUpload.isUploading}
        onPickLibrary={photoUpload.pickFromLibrary}
        onPickCamera={photoUpload.pickFromCamera}
        errorMessage={photoUpload.error}
        isRequired
      />

      <View style={styles.fields}>
        <DocumentUploadField
          label={t("Carte nationale d'identité")}
          document={nationalIdDoc}
          isUploading={upload.isUploading}
          onPickLibrary={() => upload.pickFromLibrary('national_id')}
          errorMessage={upload.errorFor('national_id')}
          onPickCamera={() => upload.pickFromCamera('national_id')}
        />
        <DocumentUploadField
          label={t('Permis de conduire')}
          document={licenseDoc}
          isUploading={upload.isUploading}
          onPickLibrary={() => upload.pickFromLibrary('driver_license')}
          errorMessage={upload.errorFor('driver_license')}
          onPickCamera={() => upload.pickFromCamera('driver_license')}
        />
      </View>

      <Button label={t('Continuer')} onPress={() => router.replace('/(driver)/(tabs)/home')} style={styles.submit} />
    </ScreenContainer>
  );
}

/**
 * Contrairement au profil client, countryId et cityId sont obligatoires
 * ici (DriverProfile, section 5) — un conducteur opère depuis une ville
 * précise, contrairement à un client qui peut réserver depuis n'importe où.
 */
export default function DriverCompleteProfileScreen() {
  const t = useT();
  // Nom, prénom et pays déjà saisis à l'inscription : on les reprend ; l'e-mail aussi est déjà géré à l'inscription (étape facultative).
  const draft = useAuthFlowStore();
  const accountEmail = useAuthStore((state) => state.user?.email);
  const hasEmail = Boolean(accountEmail);
  const [firstName, setFirstName] = useState(draft.firstName);
  const [lastName, setLastName] = useState(draft.lastName);
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState<Country | null>(draft.country);
  const [city, setCity] = useState<City | null>(null);
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isProfileCreated, setProfileCreated] = useState(false);
  const createProfile = useCreateDriverProfile();
  const goBack = useProfileStepBack('DRIVER');

  const citySelection = useCitySelectionStore((state) => state.selection);
  const consumeCitySelection = useCitySelectionStore((state) => state.consume);
  const openCityPicker = useCitySelectionStore((state) => state.openFor);

  useEffect(() => {
    if (citySelection?.field === CITY_FIELD) {
      setCity(citySelection.city);
      consumeCitySelection();
    }
  }, [citySelection, consumeCitySelection]);

  // Un passager qui devient conducteur : son nom, son pays et sa ville sont repris de son profil passager.
  const { data: customerProfile } = useCustomerProfile();
  useEffect(() => {
    if (!customerProfile) return;
    setFirstName((current) => current || customerProfile.firstName);
    setLastName((current) => current || customerProfile.lastName);
    setCountry((current) => current ?? customerProfile.country);
    setCity((current) => current ?? customerProfile.city);
  }, [customerProfile]);

  if (isProfileCreated) {
    return <IdentityDocumentsStep firstName={firstName} lastName={lastName} />;
  }

  function handleSubmit() {
    setErrorMessage(undefined);
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setErrorMessage(t('Renseignez votre prénom et votre nom.'));
      return;
    }
    if (!country || !city) {
      setErrorMessage(t('Choisissez votre pays et votre ville.'));
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage(t('Adresse email invalide.'));
      return;
    }

    createProfile.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: hasEmail ? undefined : trimmedEmail || undefined,
        countryId: country.id,
        cityId: city.id,
        mobileMoneyNumber: mobileMoneyNumber.trim() || undefined,
      },
      {
        onSuccess: () => {
          draft.reset();
          setProfileCreated(true);
        },
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue.'));
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      {goBack ? (
        <View style={styles.topBar}>
          <IconButton icon={<IconArrowLeft size={18} color={colors.textPrimary} />} accessibilityLabel={t('Retour')} onPress={goBack} />
        </View>
      ) : null}
      <AppText variant="xxl" weight="semibold" style={styles.title}>
        {t('Complétez votre profil')}
      </AppText>
      <AppText variant="base" color="textSecondary" style={styles.subtitle}>
        {t('Ces informations sont nécessaires avant de pouvoir proposer des trajets.')}
      </AppText>

      <View style={styles.fields}>
        <TextField label={t('Prénom')} value={firstName} onChangeText={setFirstName} placeholder={t('Mamadou')} autoFocus={!draft.firstName} />
        <TextField label={t('Nom')} value={lastName} onChangeText={setLastName} placeholder={t('Barry')} />
        {hasEmail ? null : (
          <>
            <TextField
              label={t('Email (optionnel)')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('vous@exemple.com')}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <AppText variant="xs" color="textMuted">
              {t('Pour recevoir aussi vos notifications par email.')}
            </AppText>
          </>
        )}

        <CountrySelectField label={t('Pays')} value={country} onSelect={setCountry} />

        <View>
          <AppText variant="sm" weight="medium" color="textSecondary" style={styles.cityLabel}>
            {t('Ville')}
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
                {city?.name ?? t('Choisir une ville')}
              </AppText>
            </View>
          </Card>
        </View>

        <TextField
          label={t('Numéro Mobile Money (optionnel)')}
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

      <Button label={t('Continuer')} onPress={handleSubmit} loading={createProfile.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
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
