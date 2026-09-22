// mobile/app/(driver)/edit-profile.tsx
// [21/09/2026] v2 — habillage bleu Ocean, comme l'espace client : en-tête,
// photo de profil et champs dans une section à en-tête souligné.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconUserCircle } from '@tabler/icons-react-native';
import { AppText, ProfilePhotoField, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanScreenHeader, OceanSection } from '@/components/ocean/OceanKit';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useDriverProfile, useUpdateDriverProfile } from '@/hooks/useDriverProfile';
import { useDriverPhotoUpload } from '@/hooks/useDriverPhotoUpload';
import { ApiError } from '@/services/api/ApiError';

export default function DriverEditProfileScreen() {
  const { data: profile } = useDriverProfile();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState(profile?.mobileMoneyNumber ?? '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl ?? null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const updateProfile = useUpdateDriverProfile();
  const photoUpload = useDriverPhotoUpload((updated) => setPhotoUrl(updated.photoUrl));

  function handleSubmit() {
    setErrorMessage(undefined);
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setErrorMessage('Renseignez votre prénom et votre nom.');
      return;
    }

    updateProfile.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mobileMoneyNumber: mobileMoneyNumber.trim() || undefined,
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
      <OceanScreenHeader title="Modifier le profil" subtitle="Compte chauffeur" onBack={() => router.back()} />

      <ProfilePhotoField
        photoUrl={photoUrl}
        initials={`${firstName.charAt(0)}${lastName.charAt(0)}`}
        isUploading={photoUpload.isUploading}
        onPickLibrary={photoUpload.pickFromLibrary}
        onPickCamera={photoUpload.pickFromCamera}
        isRequired={!profile?.isVerifiedBadge}
      />
      <View style={{ height: spacing.lg }} />

      <OceanSection icon={<IconUserCircle size={17} color={OCEAN.base} />} title="Identité">
        <TextField label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Mamadou" />
        <TextField label="Nom" value={lastName} onChangeText={setLastName} placeholder="Barry" />
        <TextField
          label="Numéro Mobile Money"
          value={mobileMoneyNumber}
          onChangeText={setMobileMoneyNumber}
          placeholder="+224620000000"
          keyboardType="phone-pad"
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
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.lg,
  },
});