// mobile/src/components/screens/ReportUserScreen.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [11/10/2026] v1 — « Signaler ou bloquer » une personne rencontrée sur un trajet, une réservation ou un envoi. On choisit un motif (détails
// facultatifs) ; on peut aussi bloquer en même temps, ou bloquer sans signaler. Paramètres de la page : driverId OU customerId OU userId
// (la personne visée), name, et le contexte tripId / bookingId / shipmentId s'il y en a un. Partagé entre l'espace client et l'espace conducteur.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconCircleCheck, IconFlag3, IconUserOff } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanChip, OceanSection, OceanSwitchRow } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { ApiError } from '@/services/api/ApiError';
import { useBlockUser, useReportUser } from '@/hooks/useSafety';
import type { UserReportReason, UserTarget } from '@/types/safety.types';
import { useT, translate } from '@/i18n';

export const REPORT_REASONS: { value: UserReportReason; label: string }[] = [
  { value: 'UNSAFE_BEHAVIOR', get label() { return translate('Comportement dangereux'); } },
  { value: 'HARASSMENT', get label() { return translate('Harcèlement ou propos déplacés'); } },
  { value: 'FRAUD', get label() { return translate('Fraude ou arnaque'); } },
  { value: 'NO_SHOW', get label() { return translate('Absent au rendez-vous'); } },
  { value: 'FAKE_PROFILE', get label() { return translate('Faux profil'); } },
  { value: 'INAPPROPRIATE_CONTENT', get label() { return translate('Contenu inapproprié'); } },
  { value: 'OTHER', get label() { return translate('Autre'); } },
];

type Params = { userId?: string; driverId?: string; customerId?: string; name?: string; tripId?: string; bookingId?: string; shipmentId?: string };
type Done = { kind: 'reported' | 'blocked'; blocked: boolean; alreadyReported?: boolean };

export function ReportUserScreen() {
  const t = useT();
  const params = useLocalSearchParams<Params>();
  const report = useReportUser();
  const block = useBlockUser();
  const [reason, setReason] = useState<UserReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState<Done | null>(null);

  const name = params.name?.trim() || t('cette personne');
  const target: UserTarget = {
    userId: params.userId || undefined,
    driverId: params.driverId || undefined,
    customerId: params.customerId || undefined,
  };
  const hasTarget = Boolean(target.userId || target.driverId || target.customerId);

  function fail(err: unknown) {
    setError(err instanceof ApiError ? err.message : t('Une erreur est survenue. Réessayez.'));
  }

  function submitReport() {
    setError(undefined);
    if (!reason) {
      setError(t('Choisissez le motif du signalement.'));
      return;
    }
    report.mutate(
      {
        ...target,
        reason,
        details: details.trim() || undefined,
        tripId: params.tripId || undefined,
        bookingId: params.bookingId || undefined,
        shipmentId: params.shipmentId || undefined,
        alsoBlock,
      },
      { onSuccess: (result) => setDone({ kind: 'reported', blocked: result.blocked, alreadyReported: result.alreadyReported }), onError: fail },
    );
  }

  function submitBlockOnly() {
    setError(undefined);
    block.mutate(target, { onSuccess: () => setDone({ kind: 'blocked', blocked: true }), onError: fail });
  }

  if (done) {
    return (
      <ScreenContainer scroll maxWidth="form">
        <OceanHeroHeader title={done.kind === 'blocked' ? t('Personne bloquée') : t('Signalement envoyé')} icon={<IconCircleCheck />} onBack={() => router.back()} />
        <View style={styles.doneBox}>
          <FeedbackBanner
            tone="success"
            title={done.kind === 'blocked' ? t('{name} est bloqué(e)', { name }) : done.alreadyReported ? t('Déjà signalé') : t('Merci, nous examinons votre signalement')}
            text={
              done.kind === 'blocked'
                ? t('Vous ne pourrez plus vous réserver, vous inviter ni vous écrire. Vous pouvez débloquer cette personne depuis votre profil.')
                : done.blocked
                  ? t('Notre équipe l’examine. Vous avez aussi bloqué cette personne.')
                  : t('Notre équipe l’examine. Vous n’avez pas besoin de faire autre chose.')
            }
          />
          <OceanButton label={t('Fermer')} onPress={() => router.back()} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title={t('Signaler ou bloquer')} subtitle={name} icon={<IconFlag3 />} onBack={() => router.back()} />

      {!hasTarget ? (
        <FeedbackBanner tone="error" text={t('Cette personne n’a pas pu être identifiée. Revenez en arrière et réessayez depuis la page du trajet ou de la réservation.')} />
      ) : (
        <>
          <OceanSection icon={<IconFlag3 size={17} color={OCEAN.base} />} title={t('Pourquoi signaler ?')} style={styles.section}>
            <View style={styles.chips}>
              {REPORT_REASONS.map((item) => (
                <OceanChip key={item.value} label={item.label} active={reason === item.value} onPress={() => setReason(item.value)} />
              ))}
            </View>
            <TextField
              label={t('Détails (facultatif)')}
              value={details}
              onChangeText={setDetails}
              placeholder={t('Que s’est-il passé ?')}
              multiline
              maxLength={1000}
              style={styles.details}
            />
            <OceanSwitchRow value={alsoBlock} onChange={setAlsoBlock} label={t('Bloquer aussi cette personne')} description={t('Plus de réservation, d’invitation ni de message entre vous.')} />
            {error ? (
              <AppText variant="sm" color="danger">
                {error}
              </AppText>
            ) : null}
            <OceanButton label={t('Envoyer le signalement')} onPress={submitReport} loading={report.isPending} disabled={block.isPending} />
          </OceanSection>

          <OceanSection icon={<IconUserOff size={17} color={OCEAN.base} />} title={t('Bloquer sans signaler')} style={styles.section}>
            <AppText variant="xs" color="textSecondary">
              {t('Vous ne voulez plus avoir affaire à {name} ? Le blocage est immédiat et la personne n’en est pas informée.', { name })}
            </AppText>
            <OceanButton label={t('Bloquer seulement')} variant="danger" icon={<IconUserOff size={16} color={colors.danger} />} onPress={submitBlockOnly} loading={block.isPending} disabled={report.isPending} />
          </OceanSection>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  details: { minHeight: 80, textAlignVertical: 'top' },
  doneBox: { gap: spacing.md, marginBottom: spacing.lg },
});
