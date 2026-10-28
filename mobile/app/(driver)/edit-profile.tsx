// mobile/app/(driver)/edit-profile.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
// [21/09/2026] v2 — habillage bleu Ocean, comme l'espace client : en-tête,
// photo de profil et champs dans une section à en-tête souligné.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconDeviceMobile, IconLock, IconUserCircle } from '@tabler/icons-react-native';
import { AppText, ProfilePhotoField, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanSection } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { LockedField } from '@/components/screens/LockedField';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useDriverProfile, useUpdateDriverProfile } from '@/hooks/useDriverProfile';
import { useDriverPhotoUpload } from '@/hooks/useDriverPhotoUpload';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/ApiError';
import { useT } from '@/i18n';

export default function DriverEditProfileScreen() {
  const t = useT();
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
      setErrorMessage(t('Renseignez votre prénom et votre nom.'));
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage(t('Adresse email invalide.'));
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
          // Le profil conducteur invalidé par le hook ne contient pas
          // l'email (voir plus haut) — sans ça, l'écran continuerait
          // d'afficher l'ancienne adresse jusqu'à la prochaine connexion.
          if (trimmedEmail && authUser) {
            useAuthStore.setState({ user: { ...authUser, email: trimmedEmail } });
          }
          router.back();
        },
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue.'));
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title={t('Modifier le profil')} subtitle={t('Compte conducteur')} icon={<IconUserCircle />} onBack={() => router.back()} />

      <ProfilePhotoField
        photoUrl={photoUrl}
        initials={`${firstName.charAt(0)}${lastName.charAt(0)}`}
        isUploading={photoUpload.isUploading}
        onPickLibrary={photoUpload.pickFromLibrary}
        onPickCamera={photoUpload.pickFromCamera}
        errorMessage={photoUpload.error}
        isRequired={!profile?.isVerifiedBadge}
      />
      <View style={{ height: spacing.lg }} />

      <OceanSection icon={<IconUserCircle size={17} color={OCEAN.base} />} title={t('Identité')}>
        <TextField label={t('Prénom')} value={firstName} onChangeText={setFirstName} placeholder={t('Mamadou')} />
        <TextField label={t('Nom')} value={lastName} onChangeText={setLastName} placeholder={t('Barry')} />
        <TextField
          label={t('Email (optionnel)')}
          value={email}
          onChangeText={setEmail}
          placeholder={t('vous@exemple.com')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {/* Le numéro de connexion ne se change que par le parcours avec code SMS ; le Mobile Money, lui, est un réglage à part. */}
        <LockedField label={t('Téléphone (connexion)')} value={authUser?.phone} />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(driver)/change-phone')}
          style={({ pressed }) => [styles.changePhone, pressed && styles.pressed]}
        >
          <IconDeviceMobile size={15} color={OCEAN.base} />
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            {t('Changer mon numéro')}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(driver)/change-password')}
          style={({ pressed }) => [styles.changePhone, pressed && styles.pressed]}
        >
          <IconLock size={15} color={OCEAN.base} />
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            {t('Changer mon mot de passe')}
          </AppText>
        </Pressable>
        <TextField
          label={t('Numéro Mobile Money')}
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

      <OceanButton label={t('Enregistrer')} onPress={handleSubmit} loading={updateProfile.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  changePhone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.lg,
  },
});
