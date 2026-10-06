// mobile/src/components/screens/CreateDisputeScreen.tsx
//
// v2 — Habillage bleu océan (partagé client / conducteur) : en-tête avec
// retour, encadré qui rassure (le support répond ici), saisie dans une
// section à en-tête soulignée, bouton plein. Logique inchangée.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconAlertTriangle, IconLifebuoy } from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanCard, OceanScreenHeader, OceanSection } from '@/components/ocean/OceanKit';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCreateDispute } from '@/hooks/useDisputes';
import { ApiError } from '@/services/api/ApiError';
import type { DisputeSubjectType } from '@/types/disputes.types';
import { FLOW_DONE_PARAM } from '@/utils/navigation';

export interface CreateDisputeScreenProps {
  basePath: '/(customer)' | '/(driver)';
}

/**
 * Toujours ouvert depuis le détail d'une réservation ou d'un envoi —
 * jamais de sélection de contexte ici, elle est déjà faite par l'écran
 * appelant. `reason`/`description` peuvent arriver pré-remplis (ex. le
 * bouton contextuel « passager/destinataire injoignable » sur la carte
 * de code) : l'utilisateur reste libre de les modifier avant l'envoi.
 */
export function CreateDisputeScreen({ basePath }: CreateDisputeScreenProps) {
  const {
    subjectType,
    bookingId,
    shipmentId,
    reason: prefillReason,
    description: prefillDescription,
  } = useLocalSearchParams<{
    subjectType: DisputeSubjectType;
    bookingId?: string;
    shipmentId?: string;
    reason?: string;
    description?: string;
  }>();
  const [reason, setReason] = useState(prefillReason ?? '');
  const [description, setDescription] = useState(prefillDescription ?? '');
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
        onSuccess: (dispute) =>
          router.replace({ pathname: `${basePath}/dispute/[id]`, params: { id: dispute.id, ...FLOW_DONE_PARAM } }),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanScreenHeader title="Signaler un problème" subtitle="Notre équipe vous répond ici" onBack={() => router.back()} />

      <OceanCard style={styles.intro}>
        <View style={styles.introIcon}>
          <IconLifebuoy size={22} color={OCEAN.base} />
        </View>
        <AppText variant="sm" color="textSecondary" style={styles.introText}>
          Décrivez ce qui s'est passé — notre équipe support vous répondra directement ici.
        </AppText>
      </OceanCard>

      <OceanSection icon={<IconAlertTriangle size={17} color={OCEAN.base} />} title="Votre signalement">
        {prefillReason ? (
          <AppText variant="xs" color="textMuted">
            Motif pré-rempli à partir de votre situation — modifiez-le si besoin.
          </AppText>
        ) : null}
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
      </OceanSection>

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <OceanButton label="Envoyer au support" onPress={handleSubmit} loading={createDispute.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: {
    flex: 1,
  },
  descriptionField: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.lg,
  },
});