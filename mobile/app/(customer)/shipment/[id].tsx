// mobile/app/(customer)/shipment/[id].tsx
// [09/10/2026] v5 — Page allégée, comme le suivi du conducteur : on ne montre que l'essentiel (statut, conducteur, code à donner,
// action à faire) ; période, suivi détaillé, expéditeur, destinataire et montant passent sous « Voir tous les détails ».
// « Annuler l'envoi » et « Être remboursé » ne passent plus par Alert.alert (sans effet sur le web) mais par ConfirmDialog, avec
// un message d'erreur dans la page. « Signaler un problème » reste toujours proposé.
// [30/09/2026] v4 — le client voit désormais aussi le code de livraison (DeliveryCodeCard, pendant DELIVERY_PENDING), et pas seulement celui de récupération : le destinataire le reçoit toujours par SMS, mais l'expéditeur peut maintenant le retrouver dans son espace.
// [21/09/2026] v3 — Habillage bleu océan ; logique inchangée : période, prolongation ou remboursement, montant unique payé, messagerie dès qu'un conducteur est assigné.
//
// Un bandeau sombre porte le statut (avec la couleur qui va avec : bleu en
// cours, vert livré, rouge annulé), suivi de la période, de la frise de
// suivi, de l'expéditeur, du destinataire et du montant payé.

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconCalendarEvent,
  IconCash,
  IconChevronDown,
  IconChevronUp,
  IconMapPin,
  IconMessageCircle,
  IconPackage,
  IconRoute,
  IconSearch,
  IconSend,
  IconUser,
  IconUserCheck,
} from '@tabler/icons-react-native';
import { AppText, ConfirmDialog, ScreenContainer } from '@/components/ui';
import {
  OceanButton,
  OceanCard,
  OceanHeroCard,
  OceanPill,
  OceanScreenHeader,
  OceanSection,
} from '@/components/ocean/OceanKit';
import { ShipmentExtensionCard } from '@/components/screens/ShipmentExtensionCard';
import { ContactRow } from '@/components/screens/ContactRow';
import { OtpCodeCard } from '@/components/screens/OtpCodeCard';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCancelShipment, useExtendShipment, useShipment } from '@/hooks/useShipments';
import { useRevealShipmentDeliveryOtpForSender, useRevealShipmentPickupOtpForSender } from '@/hooks/useShipmentOtp';
import { useShipmentInvitations } from '@/hooks/useShipmentInvitations';
import { useShipmentRatings } from '@/hooks/useRatings';
import { useGetOrCreateConversationForShipment } from '@/hooks/useConversations';
import { formatMoney } from '@/utils/money';
import { formatDateLong, formatTime } from '@/utils/date';
import { formatLocation, formatWindow } from '@/utils/shipmentDisplay';
import { closeToHome } from '@/utils/navigation';
import { ApiError } from '@/services/api/ApiError';
import type { ShipmentStatus } from '@/types/shipments.types';

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  CREATED: 'En attente de paiement',
  SEARCHING_DRIVER: "Recherche d'un conducteur",
  DRIVER_ASSIGNED: 'Conducteur trouvé',
  PICKUP_PENDING: 'Récupération en cours',
  PICKED_UP: 'Colis récupéré',
  IN_TRANSIT: 'En transit',
  DELIVERY_PENDING: 'Livraison en cours',
  DELIVERED: 'Livré',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  DISPUTED: 'En litige',
  REFUNDED: 'Remboursé',
};

const CANCELLABLE_STATUSES: ShipmentStatus[] = ['CREATED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'PICKUP_PENDING'];

/** La couleur du bandeau raconte l'état de l'envoi au premier coup d'œil. */
function heroColorFor(status: ShipmentStatus): string {
  if (status === 'DELIVERED' || status === 'COMPLETED') return colors.successDeep;
  if (status === 'CANCELLED' || status === 'REFUNDED') return colors.textSecondary;
  if (status === 'DISPUTED') return colors.danger;
  return OCEAN.deep;
}

function PickupCodeCard({ shipmentId }: { shipmentId: string }) {
  const reveal = useRevealShipmentPickupOtpForSender(shipmentId);

  return (
    <OtpCodeCard
      title="Code de récupération"
      description="Communiquez-le au conducteur pour confirmer la remise du colis — envoyé par SMS, et récupérable ici si besoin (copie directe possible)."
      code={reveal.data?.code}
      smsSent={reveal.data?.smsSent}
      isPending={reveal.isPending}
      isError={reveal.isError}
      error={reveal.error}
      onRequest={() => reveal.mutate()}
    />
  );
}

/** Même principe que PickupCodeCard, pour la livraison : le SMS part sur le téléphone du destinataire, mais l'expéditeur peut aussi le retrouver ici. */
function DeliveryCodeCard({ shipmentId }: { shipmentId: string }) {
  const reveal = useRevealShipmentDeliveryOtpForSender(shipmentId);

  return (
    <OtpCodeCard
      title="Code de livraison"
      description="Envoyé par SMS au destinataire, qui le communique au conducteur pour confirmer la réception — récupérable ici aussi si besoin (copie directe possible)."
      code={reveal.data?.code}
      smsSent={reveal.data?.smsSent}
      isPending={reveal.isPending}
      isError={reveal.isError}
      error={reveal.error}
      onRequest={() => reveal.mutate()}
    />
  );
}

export default function ShipmentDetailScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { data: shipment, isLoading, isError } = useShipment(id);
  const cancelShipment = useCancelShipment(id ?? '');
  const extendShipment = useExtendShipment(id ?? '');
  const [extensionError, setExtensionError] = useState<string | undefined>();
  const [showDetails, setShowDetails] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [confirmRefundOpen, setConfirmRefundOpen] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const getOrCreateConversation = useGetOrCreateConversationForShipment();
  const { data: existingRatings } = useShipmentRatings(id);
  const { data: invitations } = useShipmentInvitations(id, shipment?.status === 'SEARCHING_DRIVER');
  const pendingInvitations = (invitations ?? []).filter((invitation) => invitation.status === 'PENDING').length;

  if (isLoading || !shipment) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
        {isError ? (
          <AppText variant="sm" color="danger">
            Impossible de charger cet envoi.
          </AppText>
        ) : (
          <ActivityIndicator color={OCEAN.base} />
        )}
      </ScreenContainer>
    );
  }

  const canCancel = CANCELLABLE_STATUSES.includes(shipment.status);
  const tracking = shipment.tracking ?? [];
  const hasRated = (existingRatings?.length ?? 0) > 0;

  const isPaid = shipment.status !== 'CREATED';
  const needsExtensionAnswer = shipment.status === 'SEARCHING_DRIVER' && shipment.extensionRequestedAt !== null;
  const currencyCode = shipment.currency?.isoCode;

  function handleExtend(windowEnd: string) {
    setExtensionError(undefined);
    extendShipment.mutate(
      { windowEnd },
      {
        onError: (error) =>
          setExtensionError(error instanceof ApiError ? error.message : 'La prolongation a échoué — réessayez.'),
      },
    );
  }

  function handleRefund() {
    setActionError(undefined);
    cancelShipment.mutate(
      { reason: 'Aucun conducteur avant la fin de la période — remboursement demandé par le client.' },
      {
        onSuccess: () => setConfirmRefundOpen(false),
        onError: (error) => {
          setConfirmRefundOpen(false);
          setActionError(error instanceof ApiError ? error.message : 'La demande a échoué — réessayez.');
        },
      },
    );
  }

  function handleCancel() {
    setActionError(undefined);
    cancelShipment.mutate(
      { reason: "Annulé depuis l'application" },
      {
        onSuccess: () => setConfirmCancelOpen(false),
        onError: (error) => {
          setConfirmCancelOpen(false);
          setActionError(error instanceof ApiError ? error.message : "L'annulation a échoué — réessayez.");
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader
        title="Suivi de l'envoi"
        subtitle={shipment.category?.name ?? 'Colis'}
        onBack={() => router.back()}
        // Affiché juste après la création ou le paiement : une croix qui revient à l'accueil.
        onClose={created ? () => closeToHome('/(customer)/(tabs)/home') : undefined}
        right={
          // Colis livré sans litige : plus de messagerie avec le conducteur (comme l'appel et le SMS, retirés par le serveur).
          shipment.driverId && shipment.status !== 'DELIVERED' && shipment.status !== 'COMPLETED' ? (
            <Pressable
              onPress={() =>
                getOrCreateConversation.mutate(shipment.id, {
                  onSuccess: (conversation) => router.push(`/(customer)/conversation/${conversation.id}`),
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Contacter le conducteur"
              style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
            >
              <IconMessageCircle size={18} color={OCEAN.base} />
            </Pressable>
          ) : undefined
        }
      />

      <OceanHeroCard style={[styles.hero, { backgroundColor: heroColorFor(shipment.status) }]}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <IconPackage size={26} color={OCEAN.onDark} />
          </View>
          <View style={styles.heroText}>
            <AppText variant="xs" color={OCEAN.sky}>
              Statut de l’envoi
            </AppText>
            <AppText variant="lg" weight="bold" color={OCEAN.onDark}>
              {STATUS_LABELS[shipment.status]}
            </AppText>
          </View>
        </View>
        <AppText variant="sm" color={OCEAN.onDark} style={styles.heroWeight}>
          {shipment.category?.name ?? 'Colis'} · {shipment.weightKg} kg
        </AppText>
        {!isPaid ? (
          <AppText variant="sm" weight="bold" color={OCEAN.onDark}>
            À payer : {formatMoney(shipment.totalAmount, currencyCode)}
          </AppText>
        ) : null}
      </OceanHeroCard>

      {needsExtensionAnswer ? (
        <ShipmentExtensionCard
          onExtend={handleExtend}
          onRefund={() => setConfirmRefundOpen(true)}
          isExtending={extendShipment.isPending}
          isRefunding={cancelShipment.isPending}
          errorMessage={extensionError}
        />
      ) : null}

      {shipment.driver && shipment.driverPhone ? (
        <OceanSection icon={<IconUserCheck size={17} color={OCEAN.base} />} title="Votre conducteur">
          <ContactRow phone={shipment.driverPhone} name={`${shipment.driver.firstName} ${shipment.driver.lastName[0]}.`} />
        </OceanSection>
      ) : null}

      {shipment.status === 'PICKUP_PENDING' ? <PickupCodeCard shipmentId={shipment.id} /> : null}

      {shipment.status === 'DELIVERY_PENDING' ? <DeliveryCodeCard shipmentId={shipment.id} /> : null}

      {shipment.status === 'SEARCHING_DRIVER' && !needsExtensionAnswer ? (
        <OceanCard style={styles.infoCard}>
          <AppText variant="sm" weight="semibold" color={OCEAN.deep}>
            Votre demande est visible de tous les conducteurs
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Le premier à l&apos;accepter la prend en charge. Vous serez prévenu dès qu&apos;un conducteur est trouvé.
          </AppText>
          {pendingInvitations > 0 ? (
            <OceanPill
              label={`${pendingInvitations} invitation${pendingInvitations > 1 ? 's' : ''} en attente`}
              tone="gold"
              icon={<IconSend size={13} color={OCEAN.goldInk} />}
            />
          ) : null}
          <OceanButton
            label="Chercher un conducteur"
            variant="soft"
            icon={<IconSearch size={16} color={OCEAN.base} />}
            onPress={() => router.push({ pathname: '/(customer)/shipment-find-driver', params: { id: shipment.id } })}
          />
        </OceanCard>
      ) : null}

      {showDetails ? (
        <>
      <OceanSection icon={<IconCalendarEvent size={17} color={OCEAN.base} />} title="Période choisie">
        <AppText variant="sm" weight="semibold">
          {formatWindow(shipment)}
        </AppText>
      </OceanSection>

      {tracking.length > 0 ? (
        <OceanSection icon={<IconRoute size={17} color={OCEAN.base} />} title="Suivi">
          <View>
            {tracking.map((entry, index) => (
              <View key={entry.id} style={styles.trackingRow}>
                <View style={styles.trackingDotColumn}>
                  <View style={[styles.trackingDot, index === tracking.length - 1 && styles.trackingDotActive]} />
                  {index < tracking.length - 1 ? <View style={styles.trackingLine} /> : null}
                </View>
                <View style={styles.trackingText}>
                  <AppText variant="sm" weight="semibold">
                    {STATUS_LABELS[entry.status]}
                  </AppText>
                  <AppText variant="xs" color="textSecondary">
                    {formatDateLong(entry.recordedAt)} à {formatTime(entry.recordedAt)}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </OceanSection>
      ) : null}

      <OceanSection icon={<IconUser size={17} color={OCEAN.base} />} title="Expéditeur">
        <View style={styles.person}>
          <AppText variant="base" weight="semibold">
            {shipment.senderName}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {shipment.senderPhone}
          </AppText>
        </View>
        <View style={styles.addressBox}>
          <IconMapPin size={15} color={OCEAN.base} />
          <AppText variant="xs" color="textSecondary" style={styles.addressText}>
            {formatLocation(shipment.senderLocation)}
          </AppText>
        </View>
      </OceanSection>

      <OceanSection icon={<IconUserCheck size={17} color={OCEAN.base} />} title="Destinataire">
        <View style={styles.person}>
          <AppText variant="base" weight="semibold">
            {shipment.recipientName}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {shipment.recipientPhone}
          </AppText>
        </View>
        <View style={styles.addressBox}>
          <IconMapPin size={15} color={OCEAN.base} />
          <AppText variant="xs" color="textSecondary" style={styles.addressText}>
            {formatLocation(shipment.recipientLocation)}
          </AppText>
        </View>
      </OceanSection>

      <OceanSection icon={<IconCash size={17} color={OCEAN.base} />} title="Montant">
        <View style={styles.priceRow}>
          <AppText variant="base" weight="semibold">
            Montant payé
          </AppText>
          <AppText variant="lg" weight="bold" color={OCEAN.deep}>
            {formatMoney(shipment.totalAmount, currencyCode)}
          </AppText>
        </View>
        {!isPaid ? <OceanPill label="Paiement en attente" tone="gold" /> : null}
      </OceanSection>
        </>
      ) : null}

      <OceanButton
        label={showDetails ? 'Masquer les détails' : 'Voir tous les détails'}
        variant="soft"
        icon={showDetails ? <IconChevronUp size={16} color={OCEAN.base} /> : <IconChevronDown size={16} color={OCEAN.base} />}
        onPress={() => setShowDetails((value) => !value)}
        style={styles.actionButton}
      />

      {shipment.status === 'CREATED' ? (
        <OceanButton
          label="Payer maintenant"
          onPress={() => router.push({ pathname: '/(customer)/payment', params: { shipmentId: shipment.id } })}
          style={styles.actionButton}
        />
      ) : null}

      {shipment.status === 'COMPLETED' && !hasRated ? (
        <OceanButton
          label="Noter cet envoi"
          variant="soft"
          onPress={() => router.push({ pathname: '/(customer)/rate', params: { type: 'shipment', id: shipment.id } })}
          style={styles.actionButton}
        />
      ) : null}

      {actionError ? (
        <AppText variant="sm" color="danger" style={styles.actionError}>
          {actionError}
        </AppText>
      ) : null}

      {canCancel ? (
        <OceanButton
          label="Annuler l'envoi"
          variant="outline"
          onPress={() => {
            setActionError(undefined);
            setConfirmCancelOpen(true);
          }}
          loading={cancelShipment.isPending}
          style={styles.actionButton}
        />
      ) : null}

      <OceanButton
        label="Signaler un problème"
        variant="soft"
        onPress={() =>
          router.push({
            pathname: '/(customer)/dispute-new',
            params: { subjectType: 'SHIPMENT', shipmentId: shipment.id },
          })
        }
        style={styles.actionButton}
      />

      <ConfirmDialog
        visible={confirmCancelOpen}
        title="Annuler cet envoi ?"
        message={
          isPaid
            ? 'Votre envoi sera annulé et votre paiement vous sera remboursé intégralement.'
            : 'Cette action ne peut pas être annulée.'
        }
        confirmLabel="Annuler l'envoi"
        destructive
        loading={cancelShipment.isPending}
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancelOpen(false)}
      />

      <ConfirmDialog
        visible={confirmRefundOpen}
        title="Être remboursé ?"
        message="Votre envoi sera annulé et votre paiement vous sera remboursé intégralement."
        confirmLabel="Me rembourser"
        destructive
        loading={cancelShipment.isPending}
        onConfirm={handleRefund}
        onCancel={() => setConfirmRefundOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: OCEAN.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  heroWeight: {
    opacity: 0.85,
  },
  infoCard: {
    padding: spacing.md,
    gap: 4,
    marginBottom: spacing.md,
  },
  trackingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  trackingDotColumn: {
    alignItems: 'center',
    width: 14,
  },
  trackingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: OCEAN.line,
  },
  trackingDotActive: {
    backgroundColor: OCEAN.base,
  },
  trackingLine: {
    width: 2,
    flex: 1,
    minHeight: 22,
    backgroundColor: OCEAN.line,
    marginVertical: 2,
  },
  trackingText: {
    flex: 1,
    paddingBottom: spacing.sm,
    gap: 1,
  },
  person: {
    gap: 2,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 14,
    backgroundColor: OCEAN.mist,
    padding: spacing.sm + 2,
  },
  addressText: {
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  actionError: {
    marginBottom: spacing.sm,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
});