// mobile/app/(customer)/rate.tsx
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft } from '@tabler/icons-react-native';
import { AppText, Button, IconButton, RatingStars, ScreenContainer, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useRateBooking, useRateShipment } from '@/hooks/useRatings';
import { ApiError } from '@/services/api/ApiError';

const SUB_CRITERIA = [
  { key: 'punctuality', label: 'Ponctualité' },
  { key: 'respect', label: 'Courtoisie' },
  { key: 'communication', label: 'Communication' },
  { key: 'reliability', label: 'Fiabilité' },
  { key: 'vehicleCondition', label: 'État du véhicule' },
] as const;

type SubCriterionKey = (typeof SUB_CRITERIA)[number]['key'];

export default function RateScreen() {
  const { type, id } = useLocalSearchParams<{ type: 'booking' | 'shipment'; id: string }>();
  const [score, setScore] = useState(0);
  const [subScores, setSubScores] = useState<Partial<Record<SubCriterionKey, number>>>({});
  const [comment, setComment] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const rateBooking = useRateBooking(type === 'booking' ? id : '');
  const rateShipment = useRateShipment(type === 'shipment' ? id : '');
  const mutation = type === 'booking' ? rateBooking : rateShipment;

  function handleSubmit() {
    setErrorMessage(undefined);
    if (score === 0) {
      setErrorMessage('Choisissez une note globale.');
      return;
    }

    mutation.mutate(
      { score, comment: comment.trim() || undefined, ...subScores },
      {
        onSuccess: () => {
          Alert.alert('Merci !', 'Votre avis a bien été enregistré.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
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
          Laisser un avis
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.overallBlock}>
        <AppText variant="base" color="textSecondary" align="center" style={styles.overallLabel}>
          Comment s'est passé {type === 'booking' ? 'ce trajet' : 'cet envoi'} ?
        </AppText>
        <RatingStars value={score} onChange={setScore} size={36} />
      </View>

      <View style={styles.subCriteria}>
        {SUB_CRITERIA.map((criterion) => (
          <View key={criterion.key} style={styles.subRow}>
            <AppText variant="sm" color="textSecondary" style={{ flex: 1 }}>
              {criterion.label}
            </AppText>
            <RatingStars
              value={subScores[criterion.key] ?? 0}
              onChange={(v) => setSubScores((current) => ({ ...current, [criterion.key]: v }))}
              size={18}
            />
          </View>
        ))}
      </View>

      <TextField
        label="Commentaire (optionnel)"
        value={comment}
        onChangeText={setComment}
        placeholder="Partagez votre expérience…"
        multiline
        style={styles.commentField}
      />

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button label="Envoyer mon avis" onPress={handleSubmit} loading={mutation.isPending} style={styles.submit} />
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
  overallBlock: {
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  overallLabel: {
    paddingHorizontal: spacing.lg,
  },
  subCriteria: {
    gap: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentField: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  error: {
    marginTop: spacing.sm,
  },
  submit: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
});
