// mobile/app/(customer)/rate.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
// [10/10/2026] v2 — « Merci ! » s'affiche dans la page (écran de remerciement avec « OK ») au lieu d'Alert.alert, sans effet sur le web :
// avant, l'avis partait mais rien ne confirmait et l'écran restait ouvert.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconStar } from '@tabler/icons-react-native';
import { AppText, Button, FeedbackBanner, RatingStars, ScreenContainer, TextField } from '@/components/ui';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { spacing } from '@/theme';
import { useRateBooking, useRateShipment } from '@/hooks/useRatings';
import { ApiError } from '@/services/api/ApiError';
import { useT, translate } from '@/i18n';

const SUB_CRITERIA = [
  { key: 'punctuality', get label() { return translate('Ponctualité'); } },
  { key: 'respect', get label() { return translate('Courtoisie'); } },
  { key: 'communication', get label() { return translate('Communication'); } },
  { key: 'reliability', get label() { return translate('Fiabilité'); } },
  { key: 'vehicleCondition', get label() { return translate('État du véhicule'); } },
] as const;

type SubCriterionKey = (typeof SUB_CRITERIA)[number]['key'];

export default function RateScreen() {
  const t = useT();
  const { type, id } = useLocalSearchParams<{ type: 'booking' | 'shipment'; id: string }>();
  const [score, setScore] = useState(0);
  const [subScores, setSubScores] = useState<Partial<Record<SubCriterionKey, number>>>({});
  const [comment, setComment] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState(false);

  const rateBooking = useRateBooking(type === 'booking' ? id : '');
  const rateShipment = useRateShipment(type === 'shipment' ? id : '');
  const mutation = type === 'booking' ? rateBooking : rateShipment;

  function handleSubmit() {
    setErrorMessage(undefined);
    if (score === 0) {
      setErrorMessage(t('Choisissez une note globale.'));
      return;
    }

    mutation.mutate(
      { score, comment: comment.trim() || undefined, ...subScores },
      {
        onSuccess: () => setSubmitted(true),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue.'));
        },
      },
    );
  }

  if (submitted) {
    return (
      <ScreenContainer scroll maxWidth="form">
        <View style={styles.thanks}>
          <FeedbackBanner tone="success" title={t('Merci !')} text={t('Votre avis a bien été enregistré.')} />
          <Button label={t('OK')} onPress={() => router.back()} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader
        title={t('Laisser un avis')}
        subtitle={t('Votre avis aide la communauté')}
        icon={<IconStar />}
        onBack={() => router.back()}
      />

      <View style={styles.overallBlock}>
        <AppText variant="base" color="textSecondary" align="center" style={styles.overallLabel}>
          {t("Comment s'est passé {value} ?", { value: type === 'booking' ? t('ce trajet') : t('cet envoi') })}
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
        label={t('Commentaire (optionnel)')}
        value={comment}
        onChangeText={setComment}
        placeholder={t('Partagez votre expérience…')}
        multiline
        style={styles.commentField}
      />

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button label={t('Envoyer mon avis')} onPress={handleSubmit} loading={mutation.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  thanks: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
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
