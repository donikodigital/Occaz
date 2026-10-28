// mobile/app/(driver)/shipment-invitations.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
//
// [10/10/2026] v2 — la carte d'invitation n'avait aucun padding (OceanCard n'en a pas de base) : en-tête, message, montant et boutons
// touchaient le cadre. Padding ajouté à la carte ; rien d'autre ne change.
//
// [09/10/2026] v1 — Invitations de colis reçues d'un client : son message, l'essentiel (d'où à où, ce que le conducteur recevra) et
// deux boutons, « Accepter » et « Refuser ». Le reste (poids, dimensions, période, trajet concerné) est sous « Voir tous les détails ».
// Accepter = accepter l'envoi : le premier conducteur qui accepte l'emporte, invité ou non. Les erreurs s'affichent dans la page
// (Alert.alert ne fait rien sur le web).
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconMailOpened,
  IconPackage,
  IconQuote,
} from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanPill } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from '@/hooks/useShipmentInvitations';
import { ApiError } from '@/services/api/ApiError';
import { formatDateLong, formatTime } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { driverNetAmount, formatDimensions, formatWindow, timeAgo } from '@/utils/shipmentDisplay';
import { FLOW_DONE_PARAM } from '@/utils/navigation';
import type { DriverInvitation } from '@/types/shipments.types';
import { useT } from '@/i18n';

function InvitationCard({
  invitation,
  showDetails,
  busy,
  onAccept,
  onDecline,
}: {
  invitation: DriverInvitation;
  showDetails: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const t = useT();
  const { shipment, trip } = invitation;
  const dimensions = formatDimensions(shipment);

  return (
    <OceanCard style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.tile}>
          <IconPackage size={20} color={colors.accentDark} />
        </View>
        <View style={styles.cardTopText}>
          <AppText variant="base" weight="bold" numberOfLines={1}>
            {shipment.senderLocation.label} → {shipment.recipientLocation.label}
          </AppText>
          <AppText variant="xs" color="textMuted">
            {timeAgo(invitation.createdAt)}
          </AppText>
        </View>
        {shipment.isUrgent ? <OceanPill label={t('Urgent')} tone="danger" /> : null}
      </View>

      <View style={styles.message}>
        <IconQuote size={16} color={OCEAN.base} />
        <AppText variant="sm" style={styles.messageText}>
          {invitation.message}
        </AppText>
      </View>

      <View style={styles.gain}>
        <AppText variant="xs" color="textSecondary">
          {t('Vous recevrez')}
        </AppText>
        <AppText variant="lg" weight="bold" color="successDark">
          {formatMoney(driverNetAmount(shipment), shipment.currencyCode)}
        </AppText>
      </View>

      {showDetails ? (
        <View style={styles.details}>
          <AppText variant="sm">
            {shipment.category.name} · {shipment.weightKg} kg{shipment.quantity > 1 ? t(' · {quantity} colis', { quantity: shipment.quantity }) : ''}
          </AppText>
          {dimensions ? (
            <AppText variant="xs" color="textSecondary">
              {dimensions}
            </AppText>
          ) : null}
          <AppText variant="xs" color="textSecondary">
            {t('À transporter : {value}', { value: formatWindow(shipment).toLowerCase() })}
          </AppText>
          {trip ? (
            <AppText variant="xs" color="textSecondary">
              {t('Votre trajet {originCityName} → {destinationCityName}, le {dateLong} à {time}', { originCityName: trip.originCityName, destinationCityName: trip.destinationCityName, dateLong: formatDateLong(trip.departureAt), time: formatTime(trip.departureAt) })}
            </AppText>
          ) : null}
          {shipment.description ? (
            <AppText variant="xs" color="textSecondary">
              {shipment.description}
            </AppText>
          ) : null}
          <AppText variant="xs" color="textMuted">
            {t('Les coordonnées du client vous sont communiquées dès que vous acceptez.')}
          </AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <OceanButton label={t('Accepter')} onPress={onAccept} disabled={busy} style={styles.action} />
        <OceanButton label={t('Refuser')} variant="outline" onPress={onDecline} disabled={busy} style={styles.action} />
      </View>
    </OceanCard>
  );
}

export default function ShipmentInvitationsScreen() {
  const t = useT();
  const { data, isLoading, isError, error, refetch } = useMyInvitations();
  const accept = useAcceptInvitation();
  const decline = useDeclineInvitation();
  const [showDetails, setShowDetails] = useState(false);
  const [errorText, setErrorText] = useState<string | undefined>();
  const [workingId, setWorkingId] = useState<string | null>(null);

  const invitations = data ?? [];

  function handleAccept(invitation: DriverInvitation) {
    setErrorText(undefined);
    setWorkingId(invitation.id);
    accept.mutate(invitation.id, {
      onSuccess: (shipment) => {
        setWorkingId(null);
        router.replace({ pathname: '/(driver)/shipment/[id]', params: { id: shipment.id, ...FLOW_DONE_PARAM } });
      },
      onError: (err) => {
        setWorkingId(null);
        setErrorText(err instanceof ApiError ? err.message : t("Impossible d'accepter pour le moment. Réessayez."));
      },
    });
  }

  function handleDecline(invitation: DriverInvitation) {
    setErrorText(undefined);
    setWorkingId(invitation.id);
    decline.mutate(invitation.id, {
      onSuccess: () => setWorkingId(null),
      onError: (err) => {
        setWorkingId(null);
        setErrorText(err instanceof ApiError ? err.message : t('Impossible de refuser pour le moment. Réessayez.'));
      },
    });
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanHeroHeader title={t('Invitations de colis')} subtitle={t('Des clients vous demandent de les aider')} icon={<IconMailOpened />} onBack={() => router.back()} />

      {errorText ? (
        <View style={styles.errorBox}>
          <IconAlertTriangle size={18} color={colors.danger} />
          <AppText variant="sm" style={styles.errorText}>
            {errorText}
          </AppText>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={OCEAN.base} style={styles.loader} />
      ) : isError ? (
        <OceanEmpty
          icon={<IconAlertTriangle size={26} color={colors.danger} />}
          title={t('Impossible de charger les invitations')}
          text={error instanceof ApiError ? error.message : t('Vérifiez votre connexion puis réessayez.')}
          action={<OceanButton label={t('Réessayer')} variant="outline" onPress={() => void refetch()} />}
        />
      ) : invitations.length === 0 ? (
        <OceanEmpty
          icon={<IconMailOpened size={26} color={OCEAN.base} />}
          title={t('Aucune invitation en attente')}
          text={t('Quand un client vous demandera de prendre son colis, vous le verrez ici.')}
          action={<OceanButton label={t('Voir les envois disponibles')} variant="soft" onPress={() => router.replace('/(driver)/shipment-available')} />}
        />
      ) : (
        <>
          {invitations.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              showDetails={showDetails}
              busy={workingId !== null}
              onAccept={() => handleAccept(invitation)}
              onDecline={() => handleDecline(invitation)}
            />
          ))}
          <OceanButton
            label={showDetails ? t('Masquer les détails') : t('Voir tous les détails')}
            variant="soft"
            icon={showDetails ? <IconChevronUp size={16} color={OCEAN.base} /> : <IconChevronDown size={16} color={OCEAN.base} />}
            onPress={() => setShowDetails((value) => !value)}
          />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: spacing.xl },
  card: { gap: spacing.md, padding: spacing.md, marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTopText: { flex: 1, gap: 2 },
  tile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: OCEAN.mist,
  },
  messageText: { flex: 1 },
  gain: { gap: 1 },
  details: { gap: 3, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: OCEAN.line },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.md,
    backgroundColor: '#FDE8E8',
  },
  errorText: { flex: 1 },
});
