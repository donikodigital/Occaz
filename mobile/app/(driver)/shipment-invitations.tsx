// mobile/app/(driver)/shipment-invitations.tsx
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
import { OceanButton, OceanCard, OceanEmpty, OceanPill, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from '@/hooks/useShipmentInvitations';
import { ApiError } from '@/services/api/ApiError';
import { formatDateLong, formatTime } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { driverNetAmount, formatDimensions, formatWindow, timeAgo } from '@/utils/shipmentDisplay';
import { FLOW_DONE_PARAM } from '@/utils/navigation';
import type { DriverInvitation } from '@/types/shipments.types';

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
        {shipment.isUrgent ? <OceanPill label="Urgent" tone="danger" /> : null}
      </View>

      <View style={styles.message}>
        <IconQuote size={16} color={OCEAN.base} />
        <AppText variant="sm" style={styles.messageText}>
          {invitation.message}
        </AppText>
      </View>

      <View style={styles.gain}>
        <AppText variant="xs" color="textSecondary">
          Vous recevrez
        </AppText>
        <AppText variant="lg" weight="bold" color="successDark">
          {formatMoney(driverNetAmount(shipment), shipment.currencyCode)}
        </AppText>
      </View>

      {showDetails ? (
        <View style={styles.details}>
          <AppText variant="sm">
            {shipment.category.name} · {shipment.weightKg} kg{shipment.quantity > 1 ? ` · ${shipment.quantity} colis` : ''}
          </AppText>
          {dimensions ? (
            <AppText variant="xs" color="textSecondary">
              {dimensions}
            </AppText>
          ) : null}
          <AppText variant="xs" color="textSecondary">
            À transporter : {formatWindow(shipment).toLowerCase()}
          </AppText>
          {trip ? (
            <AppText variant="xs" color="textSecondary">
              Votre trajet {trip.originCityName} → {trip.destinationCityName}, le {formatDateLong(trip.departureAt)} à {formatTime(trip.departureAt)}
            </AppText>
          ) : null}
          {shipment.description ? (
            <AppText variant="xs" color="textSecondary">
              {shipment.description}
            </AppText>
          ) : null}
          <AppText variant="xs" color="textMuted">
            Les coordonnées du client vous sont communiquées dès que vous acceptez.
          </AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <OceanButton label="Accepter" onPress={onAccept} disabled={busy} style={styles.action} />
        <OceanButton label="Refuser" variant="outline" onPress={onDecline} disabled={busy} style={styles.action} />
      </View>
    </OceanCard>
  );
}

export default function ShipmentInvitationsScreen() {
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
        setErrorText(err instanceof ApiError ? err.message : "Impossible d'accepter pour le moment. Réessayez.");
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
        setErrorText(err instanceof ApiError ? err.message : 'Impossible de refuser pour le moment. Réessayez.');
      },
    });
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Invitations de colis" subtitle="Des clients vous demandent de les aider" onBack={() => router.back()} />

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
          title="Impossible de charger les invitations"
          text={error instanceof ApiError ? error.message : 'Vérifiez votre connexion puis réessayez.'}
          action={<OceanButton label="Réessayer" variant="outline" onPress={() => void refetch()} />}
        />
      ) : invitations.length === 0 ? (
        <OceanEmpty
          icon={<IconMailOpened size={26} color={OCEAN.base} />}
          title="Aucune invitation en attente"
          text="Quand un client vous demandera de prendre son colis, vous le verrez ici."
          action={<OceanButton label="Voir les envois disponibles" variant="soft" onPress={() => router.replace('/(driver)/shipment-available')} />}
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
            label={showDetails ? 'Masquer les détails' : 'Voir tous les détails'}
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
  card: { gap: spacing.md, marginBottom: spacing.md },
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
