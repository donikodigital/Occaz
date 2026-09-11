// mobile/app/(customer)/edit-profile.tsx
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowLeft } from '@tabler/icons-react-native';
import { AppText, Button, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useCustomerProfile, useUpdateCustomerProfile } from '@/hooks/useCustomerProfile';
import { ApiError } from '@/services/api/ApiError';

export default function EditProfileScreen() {
  const { data: profile } = useCustomerProfile();
  const [firstName, setFirstName] = useState(profile?.firstName ?? '');
  const [lastName, setLastName] = useState(profile?.lastName ?? '');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const updateProfile = useUpdateCustomerProfile();

  function handleSubmit() {
    setErrorMessage(undefined);
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setErrorMessage('Renseignez votre prénom et votre nom.');
      return;
    }

    updateProfile.mutate(
      { firstName: firstName.trim(), lastName: lastName.trim() },
      {
        onSuccess: () => router.back(),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer maxWidth="form">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Modifier le profil
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.fields}>
        <TextField label="Prénom" value={firstName} onChangeText={setFirstName} placeholder="Fatoumata" />
        <TextField label="Nom" value={lastName} onChangeText={setLastName} placeholder="Diallo" />
      </View>

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button label="Enregistrer" onPress={handleSubmit} loading={updateProfile.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  fields: {
    gap: spacing.md,
    flex: 1,
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});
