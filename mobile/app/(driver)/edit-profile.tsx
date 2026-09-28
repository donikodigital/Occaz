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
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/ApiError';

export default function DriverEditProfileScreen() {
  const { data: profile } = useDriverProfile();
  // email vit sur User, pas sur DriverProfile (comme à l'inscription,
  // voir complete-profile.tsx) — sa valeur actuelle vient donc du store
  // d'authentification, pas de `profile`.
  const authUser = useAuthStore((state) => state.user);
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [email, setEmail] = useState(authUser?.email ?? '');
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
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Adresse email invalide.');
      return;
    }

    updateProfile.mutate(
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: trimmedEmail || undefined,
        mobileMoneyNumber: mobileMoneyNumber.trim() || undefined,
      },
      {
        onSuccess: () => {
          // Le profil chauffeur invalidé par le hook ne contient pas
          // l'email (voir plus haut) — sans ça, l'écran continuerait
          // d'afficher l'ancienne adresse jusqu'à la prochaine connexion.
          if (trimmedEmail && authUser) {
            useAuthStore.setState({ user: { ...authUser, email: trimmedEmail } });
          }
          router.back();
        },
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
          label="Email (optionnel)"
          value={email}
          onChangeText={setEmail}
          placeholder="vous@exemple.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
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