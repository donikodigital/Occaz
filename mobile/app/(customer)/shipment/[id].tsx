// mobile/app/(customer)/shipment/[id].tsx
import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft, IconMapPin, IconPackage } from '@tabler/icons-react-native';
import { AppText, Badge, Button, Card, Divider, IconButton, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useCancelShipment, useShipment } from '@/hooks/useShipments';
import { formatMoney } from '@/utils/money';
import { formatDateLong, formatTime } from '@/utils/date';
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

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: shipment, isLoading, isError } = useShipment(id);
  const cancelShipment = useCancelShipment(id ?? '');

  if (isLoading || !shipment) {
    return (
      <ScreenContainer style={styles.center}>
        {isError ? (
          <AppText variant="sm" color="danger">
            Impossible de charger cet envoi.
          </AppText>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </ScreenContainer>
    );
  }

  const canCancel = CANCELLABLE_STATUSES.includes(shipment.status);
  const tracking = shipment.tracking ?? [];

  function handleCancel() {
    Alert.alert('Annuler cet envoi ?', 'Cette action ne peut pas être annulée.', [
      { text: 'Retour', style: 'cancel' },
      {
        text: "Annuler l'envoi",
        style: 'destructive',
        onPress: () =>
          cancelShipment.mutate(
            { reason: "Annulé depuis l'application" },
            { onError: () => Alert.alert('Erreur', "L'annulation a échoué — réessayez.") },
          ),
      },
    ]);
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Suivi de l'envoi
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.statusBlock}>
        <View style={styles.statusIcon}>
          <IconPackage size={26} color={colors.successDark} />
        </View>
        <Badge
          label={STATUS_LABELS[shipment.status]}
          tone={
            shipment.status === 'CANCELLED'
              ? 'danger'
              : shipment.status === 'DELIVERED' || shipment.status === 'COMPLETED'
                ? 'success'
                : 'primary'
          }
        />
      </View>

      {tracking.length > 0 ? (
        <Card style={styles.card}>
          <AppText variant="base" weight="semibold" style={styles.cardTitle}>
            Suivi
          </AppText>
          {tracking.map((entry, index) => (
            <View key={entry.id} style={styles.trackingRow}>
              <View style={styles.trackingDotColumn}>
                <View style={[styles.trackingDot, index === tracking.length - 1 && styles.trackingDotActive]} />
                {index < tracking.length - 1 ? <View style={styles.trackingLine} /> : null}
              </View>
              <View style={styles.trackingText}>
                <AppText variant="sm" weight="medium">
                  {STATUS_LABELS[entry.status]}
                </AppText>
                <AppText variant="xs" color="textSecondary">
                  {formatDateLong(entry.recordedAt)} à {formatTime(entry.recordedAt)}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Card style={styles.card}>
        <AppText variant="base" weight="semibold" style={styles.cardTitle}>
          Expéditeur
        </AppText>
        <AppText variant="sm">{shipment.senderName}</AppText>
        <AppText variant="sm" color="textSecondary">
          {shipment.senderPhone}
        </AppText>
        <View style={styles.addressRow}>
          <IconMapPin size={13} color={colors.textSecondary} />
          <AppText variant="xs" color="textSecondary" style={{ flex: 1 }}>
            {shipment.senderLocation?.label ?? '—'}
          </AppText>
        </View>
      </Card>

      <Card style={styles.card}>
        <AppText variant="base" weight="semibold" style={styles.cardTitle}>
          Destinataire
        </AppText>
        <AppText variant="sm">{shipment.recipientName}</AppText>
        <AppText variant="sm" color="textSecondary">
          {shipment.recipientPhone}
        </AppText>
        <View style={styles.addressRow}>
          <IconMapPin size={13} color={colors.textSecondary} />
          <AppText variant="xs" color="textSecondary" style={{ flex: 1 }}>
            {shipment.recipientLocation?.label ?? '—'}
          </AppText>
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.priceRow}>
          <AppText variant="sm" color="textSecondary">
            {shipment.category?.name ?? 'Colis'} · {shipment.weightKg} kg
          </AppText>
          <AppText variant="sm">{formatMoney(shipment.price)}</AppText>
        </View>
        <View style={styles.priceRow}>
          <AppText variant="sm" color="textSecondary">
            Frais de service
          </AppText>
          <AppText variant="sm">{formatMoney(shipment.platformFee)}</AppText>
        </View>
        <Divider />
        <View style={styles.priceRow}>
          <AppText variant="base" weight="semibold">
            Total
          </AppText>
          <AppText variant="base" weight="semibold">
            {formatMoney(shipment.totalAmount)}
          </AppText>
        </View>
      </Card>

      {shipment.status === 'CREATED' ? (
        <Button
          label="Payer maintenant"
          onPress={() =>
            Alert.alert('Bientôt disponible', 'Le paiement en ligne arrive dans une prochaine mise à jour.')
          }
          style={styles.actionButton}
        />
      ) : null}

      {canCancel ? (
        <Button
          label="Annuler l'envoi"
          variant="outline"
          onPress={handleCancel}
          loading={cancelShipment.isPending}
          style={styles.actionButton}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    gap: 4,
    marginBottom: spacing.md,
  },
  cardTitle: {
    marginBottom: spacing.xxs,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  trackingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  trackingDotColumn: {
    alignItems: 'center',
    width: 12,
  },
  trackingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  trackingDotActive: {
    backgroundColor: colors.success,
  },
  trackingLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  trackingText: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  actionButton: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
});
