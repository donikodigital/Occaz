// mobile/app/(customer)/complete-profile.tsx
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Button, ScreenContainer, TextField } from '@/components/ui';
import { spacing } from '@/theme';
import { useCreateCustomerProfile } from '@/hooks/useCustomerProfile';
import { ApiError } from '@/services/api/ApiError';

/**
 * Étape obligatoire après la toute première connexion (section 57) : le
 * compte User existe mais aucun CustomerProfile n'est encore rattaché
 * (POST /customer-profiles/me côté backend, Lot 2). Sans cet écran,
 * l'app resterait bloquée sur un accueil qui ne peut rien afficher.
 */
export default function CompleteProfileScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const createProfile = useCreateCustomerProfile();

  function handleSubmit() {
    setErrorMessage(undefined);
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setErrorMessage('Renseignez votre prénom et votre nom.');
      return;
    }
    createProfile.mutate(
      { firstName: firstName.trim(), lastName: lastName.trim() },
      {
        onSuccess: () => router.replace('/(customer)/(tabs)/home'),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.body}>
        <AppText variant="xxl" weight="semibold" style={styles.title}>
          Complétez votre profil
        </AppText>
        <AppText variant="base" color="textSecondary" style={styles.subtitle}>
          Ces informations sont partagées avec votre chauffeur au moment de la réservation.
        </AppText>

        <View style={styles.fields}>
          <TextField
            label="Prénom"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Fatoumata"
            autoFocus
          />
          <TextField label="Nom" value={lastName} onChangeText={setLastName} placeholder="Diallo" />
        </View>

        {errorMessage ? (
          <AppText variant="sm" color="danger" style={styles.error}>
            {errorMessage}
          </AppText>
        ) : null}
      </View>

      <Button label="Continuer" onPress={handleSubmit} loading={createProfile.isPending} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: spacing.xl,
  },
  title: {
    marginBottom: spacing.xxs,
  },
  subtitle: {
    marginBottom: spacing.xl,
  },
  fields: {
    gap: spacing.md,
  },
  error: {
    marginTop: spacing.sm,
  },
});
