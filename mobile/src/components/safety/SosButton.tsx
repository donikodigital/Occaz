// mobile/src/components/safety/SosButton.tsx
// [11/10/2026] v1 — Bouton SOS. Un appui ouvre une confirmation (jamais d'alerte par erreur), puis envoie la position aux proches enregistrés
// (SMS) et à l'équipe Occa'Z. Tant qu'une alerte est en cours, la carte l'affiche (l'état vient du serveur : il survit à la fermeture de
// l'écran) avec « Je suis en sécurité » pour l'arrêter. Les erreurs s'affichent dans la page (Alert.alert ne fait rien sur le web).
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconAlertOctagon, IconShieldCheck } from '@tabler/icons-react-native';
import { AppText, ConfirmDialog, FeedbackBanner } from '@/components/ui';
import { OceanButton, OceanCard } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { ApiError } from '@/services/api/ApiError';
import { useCancelSos, useEmergencyContacts, useMySosAlerts, useTriggerSos } from '@/hooks/useSafety';
import { getBestEffortPosition } from '@/utils/currentPosition';

export interface SosButtonProps {
  /** Contexte transmis à l'équipe (et nommé dans le SMS) : le trajet, la réservation ou l'envoi en cours. */
  tripId?: string;
  bookingId?: string;
  shipmentId?: string;
}

export function SosButton({ tripId, bookingId, shipmentId }: SosButtonProps) {
  const contacts = useEmergencyContacts();
  const mine = useMySosAlerts();
  const trigger = useTriggerSos();
  const cancel = useCancelSos();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success' | 'info'; title?: string; text: string } | null>(null);

  const active = mine.data?.find((alert) => alert.status === 'OPEN' || alert.status === 'ACKNOWLEDGED');
  const contactCount = contacts.data?.length ?? 0;

  async function send() {
    setFeedback(null);
    setLocating(true);
    const position = await getBestEffortPosition();
    setLocating(false);
    trigger.mutate(
      { tripId, bookingId, shipmentId, ...position },
      {
        onSuccess: (alert) => {
          setConfirmOpen(false);
          setFeedback({
            tone: 'success',
            title: 'Alerte envoyée',
            text:
              alert.contactsNotified > 0
                ? `${alert.contactsNotified} proche${alert.contactsNotified > 1 ? 's' : ''} prévenu${alert.contactsNotified > 1 ? 's' : ''} par SMS, et l’équipe Occa’Z a été alertée.`
                : 'L’équipe Occa’Z a été alertée.',
          });
        },
        onError: (error) => {
          setConfirmOpen(false);
          setFeedback({
            tone: 'error',
            title: 'Alerte non envoyée',
            text: error instanceof ApiError ? error.message : 'Vérifiez votre connexion puis réessayez. En cas de danger, appelez les secours.',
          });
        },
      },
    );
  }

  function markSafe() {
    if (!active) return;
    setFeedback(null);
    cancel.mutate(active.id, {
      onSuccess: () => setFeedback({ tone: 'info', text: 'Alerte arrêtée. Vos proches ont été prévenus que tout va bien.' }),
      onError: (error) =>
        setFeedback({ tone: 'error', text: error instanceof ApiError ? error.message : 'Impossible d’arrêter l’alerte pour le moment.' }),
    });
  }

  return (
    <View style={styles.wrapper}>
      <OceanCard style={[styles.card, active && styles.cardActive]}>
        <View style={styles.top}>
          <View style={[styles.tile, active && styles.tileActive]}>
            <IconAlertOctagon size={22} color={colors.danger} />
          </View>
          <View style={styles.topText}>
            <AppText variant="base" weight="bold">
              {active ? 'Alerte SOS en cours' : 'Besoin d’aide ?'}
            </AppText>
            <AppText variant="xs" color="textSecondary">
              {active
                ? active.status === 'ACKNOWLEDGED'
                  ? 'L’équipe Occa’Z a vu votre alerte.'
                  : 'Vos proches et l’équipe Occa’Z ont été prévenus.'
                : 'Prévenez vos proches et l’équipe Occa’Z en un geste.'}
            </AppText>
          </View>
        </View>

        {active ? (
          <OceanButton
            label="Je suis en sécurité"
            variant="outline"
            icon={<IconShieldCheck size={18} color={colors.success} />}
            onPress={markSafe}
            loading={cancel.isPending}
          />
        ) : (
          <OceanButton label="Envoyer une alerte SOS" variant="danger" onPress={() => setConfirmOpen(true)} />
        )}
      </OceanCard>

      {feedback ? <FeedbackBanner tone={feedback.tone} title={feedback.title} text={feedback.text} onDismiss={() => setFeedback(null)} /> : null}

      <ConfirmDialog
        visible={confirmOpen}
        title="Envoyer une alerte SOS ?"
        message={
          (contactCount > 0
            ? `Vos ${contactCount} proche${contactCount > 1 ? 's' : ''} enregistré${contactCount > 1 ? 's' : ''} et l’équipe Occa’Z recevront votre position. `
            : 'L’équipe Occa’Z recevra votre position. Ajoutez des proches dans « Mes proches » pour qu’ils soient prévenus aussi. ') +
          'Si vous êtes en danger immédiat, appelez aussi les secours.'
        }
        confirmLabel="Envoyer l’alerte"
        destructive
        loading={locating || trigger.isPending}
        onConfirm={() => void send()}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm, marginBottom: spacing.md },
  card: { gap: spacing.sm, padding: spacing.md, borderColor: '#F5C2C2' },
  cardActive: { backgroundColor: '#FDE8E8', borderColor: colors.danger },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topText: { flex: 1, gap: 2 },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FDE8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileActive: { backgroundColor: colors.surface },
});
