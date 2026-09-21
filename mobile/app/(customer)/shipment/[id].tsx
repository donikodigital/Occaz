// mobile/app/(customer)/shipment/[id].tsx
// [21/09/2026] v3 — Habillage bleu océan ; logique inchangée : période, prolongation ou remboursement, montant unique payé, messagerie dès qu'un chauffeur est assigné.
//
// Un bandeau sombre porte le statut (avec la couleur qui va avec : bleu en
// cours, vert livré, rouge annulé), suivi de la période, de la frise de
// suivi, de l'expéditeur, du destinataire et du montant payé.

import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconCalendarEvent,
  IconCash,
  IconMapPin,
  IconMessageCircle,
  IconPackage,
  IconRoute,
  IconUser,
  IconUserCheck,
} from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import {
  OceanButton,
  OceanCard,
  OceanHeroCard,
  OceanPill,
  OceanScreenHeader,
  OceanSection,
} from '@/components/ocean/OceanKit';
import { ShipmentExtensionCard } from '@/components/screens/ShipmentExtensionCard';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCancelShipment, useExtendShipment, useShipment } from '@/hooks/useShipments';
import { useShipmentRatings } from '@/hooks/useRatings';
import { useGetOrCreateConversationForShipment } from '@/hooks/useConversations';
import { formatMoney } from '@/utils/money';
import { formatDateLong, formatTime } from '@/utils/date';
import { formatWindow } from '@/utils/shipmentDisplay';
import { ApiError } from '@/services/api/ApiError';
import type { ShipmentStatus } from '@/types/shipments.types';

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  CREATED: 'En attente de paiement',
  SEARCHING_DRIVER: "Recherche d'un chauffeur",
  DRIVER_ASSIGNED: 'Chauffeur trouvé',
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
  if (status === 'DELIVERED' || status === 'COMPLETED') return colors.success;
  if (status === 'CANCELLED' || status === 'REFUNDED') return colors.textSecondary;
  if (status === 'DISPUTED') return colors.danger;
  return OCEAN.deep;
}

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: shipment, isLoading, isError } = useShipment(id);
  const cancelShipment = useCancelShipment(id ?? '');
  const extendShipment = useExtendShipment(id ?? '');
  const [extensionError, setExtensionError] = useState<string | undefined>();
  const getOrCreateConversation = useGetOrCreateConversationForShipment();
  const { data: existingRatings } = useShipmentRatings(id);

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
    Alert.alert('Être remboursé ?', 'Votre envoi sera annulé et votre paiement vous sera remboursé intégralement.', [
      { text: 'Retour', style: 'cancel' },
      {
        text: 'Me rembourser',
        style: 'destructive',
        onPress: () =>
          cancelShipment.mutate(
            { reason: 'Aucun chauffeur avant la fin de la période — remboursement demandé par le client.' },
            { onError: () => Alert.alert('Erreur', 'La demande a échoué — réessayez.') },
          ),
      },
    ]);
  }

  function handleCancel() {
    Alert.alert(
      'Annuler cet envoi ?',
      isPaid
        ? 'Votre envoi sera annulé et votre paiement vous sera remboursé intégralement.'
        : 'Cette action ne peut pas être annulée.',
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: "Annuler l'envoi",
          style: 'destructive',
          onPress: () =>
            cancelShipment.mutate(
              { reason: "Annulé depuis l'application" },
              {
                onError: (error) =>
                  Alert.alert('Erreur', error instanceof ApiError ? error.message : "L'annulation a échoué — réessayez."),
              },
            ),
        },
      ],
    );
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader
        title="Suivi de l'envoi"
        subtitle={shipment.category?.name ?? 'Colis'}
        onBack={() => router.back()}
        right={
          shipment.driverId ? (
            <Pressable
              onPress={() =>
                getOrCreateConversation.mutate(shipment.id, {
                  onSuccess: (conversation) => router.push(`/(customer)/conversation/${conversation.id}`),
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Contacter le chauffeur"
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
      </OceanHeroCard>

      {needsExtensionAnswer ? (
        <ShipmentExtensionCard
          onExtend={handleExtend}
          onRefund={handleRefund}
          isExtending={extendShipment.isPending}
          isRefunding={cancelShipment.isPending}
          errorMessage={extensionError}
        />
      ) : null}

      {shipment.status === 'SEARCHING_DRIVER' && !needsExtensionAnswer ? (
        <OceanCard style={styles.infoCard}>
          <AppText variant="sm" weight="semibold" color={OCEAN.deep}>
            Votre demande est visible de tous les chauffeurs
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Le premier à l&apos;accepter la prend en charge. Vous serez prévenu dès qu&apos;un chauffeur est trouvé.
          </AppText>
        </OceanCard>
      ) : null}

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
            {shipment.senderLocation?.label ?? '—'}
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
            {shipment.recipientLocation?.label ?? '—'}
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

      {canCancel ? (
        <OceanButton
          label="Annuler l'envoi"
          variant="outline"
          onPress={handleCancel}
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
  actionButton: {
    marginBottom: spacing.sm,
  },
});