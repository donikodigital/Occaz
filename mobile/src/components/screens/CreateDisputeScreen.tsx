// mobile/src/components/screens/CreateDisputeScreen.tsx
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft } from '@tabler/icons-react-native';
import { AppText, Button, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useCreateDispute } from '@/hooks/useDisputes';
import { ApiError } from '@/services/api/ApiError';
import type { DisputeSubjectType } from '@/types/disputes.types';

export interface CreateDisputeScreenProps {
  basePath: '/(customer)' | '/(driver)';
}

/** Toujours ouvert depuis le détail d'une réservation ou d'un envoi — jamais de sélection de contexte ici, elle est déjà faite par l'écran appelant. */
export function CreateDisputeScreen({ basePath }: CreateDisputeScreenProps) {
  const { subjectType, bookingId, shipmentId } = useLocalSearchParams<{
    subjectType: DisputeSubjectType;
    bookingId?: string;
    shipmentId?: string;
  }>();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const createDispute = useCreateDispute();

  function handleSubmit() {
    setErrorMessage(undefined);
    if (reason.trim().length < 3) {
      setErrorMessage('Décrivez brièvement le problème.');
      return;
    }

    createDispute.mutate(
      {
        subjectType,
        bookingId,
        shipmentId,
        reason: reason.trim(),
        description: description.trim() || undefined,
      },
      {
        onSuccess: (dispute) => router.replace(`${basePath}/dispute/${dispute.id}`),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Signaler un problème
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <AppText variant="sm" color="textSecondary" style={styles.intro}>
        Décrivez ce qui s'est passé — notre équipe support vous répondra directement ici.
      </AppText>

      <View style={styles.fields}>
        <TextField
          label="Motif"
          value={reason}
          onChangeText={setReason}
          placeholder="Ex : Colis non reçu"
          autoFocus
        />
        <TextField
          label="Détails (optionnel)"
          value={description}
          onChangeText={setDescription}
          placeholder="Expliquez la situation…"
          multiline
          style={styles.descriptionField}
        />
      </View>

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button
        label="Envoyer au support"
        onPress={handleSubmit}
        loading={createDispute.isPending}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  intro: {
    marginBottom: spacing.lg,
  },
  fields: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  descriptionField: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});
