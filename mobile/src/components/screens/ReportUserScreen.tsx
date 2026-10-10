// mobile/src/components/screens/ReportUserScreen.tsx
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

export const REPORT_REASONS: { value: UserReportReason; label: string }[] = [
  { value: 'UNSAFE_BEHAVIOR', label: 'Comportement dangereux' },
  { value: 'HARASSMENT', label: 'Harcèlement ou propos déplacés' },
  { value: 'FRAUD', label: 'Fraude ou arnaque' },
  { value: 'NO_SHOW', label: 'Absent au rendez-vous' },
  { value: 'FAKE_PROFILE', label: 'Faux profil' },
  { value: 'INAPPROPRIATE_CONTENT', label: 'Contenu inapproprié' },
  { value: 'OTHER', label: 'Autre' },
];

type Params = { userId?: string; driverId?: string; customerId?: string; name?: string; tripId?: string; bookingId?: string; shipmentId?: string };
type Done = { kind: 'reported' | 'blocked'; blocked: boolean; alreadyReported?: boolean };

export function ReportUserScreen() {
  const params = useLocalSearchParams<Params>();
  const report = useReportUser();
  const block = useBlockUser();
  const [reason, setReason] = useState<UserReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState<Done | null>(null);

  const name = params.name?.trim() || 'cette personne';
  const target: UserTarget = {
    userId: params.userId || undefined,
    driverId: params.driverId || undefined,
    customerId: params.customerId || undefined,
  };
  const hasTarget = Boolean(target.userId || target.driverId || target.customerId);

  function fail(err: unknown) {
    setError(err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez.');
  }

  function submitReport() {
    setError(undefined);
    if (!reason) {
      setError('Choisissez le motif du signalement.');
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
        <OceanHeroHeader title={done.kind === 'blocked' ? 'Personne bloquée' : 'Signalement envoyé'} icon={<IconCircleCheck />} onBack={() => router.back()} />
        <View style={styles.doneBox}>
          <FeedbackBanner
            tone="success"
            title={done.kind === 'blocked' ? `${name} est bloqué(e)` : done.alreadyReported ? 'Déjà signalé' : 'Merci, nous examinons votre signalement'}
            text={
              done.kind === 'blocked'
                ? 'Vous ne pourrez plus vous réserver, vous inviter ni vous écrire. Vous pouvez débloquer cette personne depuis votre profil.'
                : done.blocked
                  ? 'Notre équipe l’examine. Vous avez aussi bloqué cette personne.'
                  : 'Notre équipe l’examine. Vous n’avez pas besoin de faire autre chose.'
            }
          />
          <OceanButton label="Fermer" onPress={() => router.back()} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title="Signaler ou bloquer" subtitle={name} icon={<IconFlag3 />} onBack={() => router.back()} />

      {!hasTarget ? (
        <FeedbackBanner tone="error" text="Cette personne n’a pas pu être identifiée. Revenez en arrière et réessayez depuis la page du trajet ou de la réservation." />
      ) : (
        <>
          <OceanSection icon={<IconFlag3 size={17} color={OCEAN.base} />} title="Pourquoi signaler ?" style={styles.section}>
            <View style={styles.chips}>
              {REPORT_REASONS.map((item) => (
                <OceanChip key={item.value} label={item.label} active={reason === item.value} onPress={() => setReason(item.value)} />
              ))}
            </View>
            <TextField
              label="Détails (facultatif)"
              value={details}
              onChangeText={setDetails}
              placeholder="Que s’est-il passé ?"
              multiline
              maxLength={1000}
              style={styles.details}
            />
            <OceanSwitchRow value={alsoBlock} onChange={setAlsoBlock} label="Bloquer aussi cette personne" description="Plus de réservation, d’invitation ni de message entre vous." />
            {error ? (
              <AppText variant="sm" color="danger">
                {error}
              </AppText>
            ) : null}
            <OceanButton label="Envoyer le signalement" onPress={submitReport} loading={report.isPending} disabled={block.isPending} />
          </OceanSection>

          <OceanSection icon={<IconUserOff size={17} color={OCEAN.base} />} title="Bloquer sans signaler" style={styles.section}>
            <AppText variant="xs" color="textSecondary">
              Vous ne voulez plus avoir affaire à {name} ? Le blocage est immédiat et la personne n’en est pas informée.
            </AppText>
            <OceanButton label="Bloquer seulement" variant="danger" icon={<IconUserOff size={16} color={colors.danger} />} onPress={submitBlockOnly} loading={block.isPending} disabled={report.isPending} />
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
