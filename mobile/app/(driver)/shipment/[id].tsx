// mobile/app/(driver)/shipment/[id].tsx
import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconArrowLeft, IconMapPin, IconPhone } from '@tabler/icons-react-native';
import { AppText, Badge, Button, Card, Divider, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useShipment, useCancelShipment } from '@/hooks/useShipments';
import { useAssignShipment } from '@/hooks/useDriverShipments';
import { useMyTrips } from '@/hooks/useDriverTrips';
import {
  useMarkShipmentPickupPending,
  useMarkShipmentInTransit,
  useMarkShipmentDeliveryPending,
  useRequestShipmentPickupOtp,
  useVerifyShipmentPickupOtp,
  useRequestShipmentDeliveryOtp,
  useVerifyShipmentDeliveryOtp,
} from '@/hooks/useShipmentOtp';
import { formatMoney } from '@/utils/money';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_TONE } from '@/utils/tripStatusLabels';
import { ApiError } from '@/services/api/ApiError';

function OtpSection({
  title,
  onRequest,
  onVerify,
  isRequesting,
  isVerifying,
}: {
  title: string;
  onRequest: () => void;
  onVerify: (code: string) => void;
  isRequesting: boolean;
  isVerifying: boolean;
}) {
  const [codeVisible, setCodeVisible] = useState(false);
  const [code, setCode] = useState('');

  return (
    <Card style={styles.otpCard}>
      <AppText variant="base" weight="semibold" style={styles.otpTitle}>
        {title}
      </AppText>
      {!codeVisible ? (
        <Button
          label="Demander le code"
          variant="secondary"
          onPress={() => {
            onRequest();
            setCodeVisible(true);
          }}
          loading={isRequesting}
        />
      ) : (
        <View style={styles.codeRow}>
          <TextField
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="Code à 6 chiffres"
            maxLength={6}
            style={styles.codeInput}
          />
          <Button
            label="Vérifier"
            fullWidth={false}
            onPress={() => onVerify(code)}
            loading={isVerifying}
            disabled={code.length !== 6}
          />
        </View>
      )}
    </Card>
  );
}

export default function DriverShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: shipment, isLoading, isError } = useShipment(id);
  const { data: tripsPage } = useMyTrips();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const assignShipment = useAssignShipment(id ?? '');
  const cancelShipment = useCancelShipment(id ?? '');
  const markPickupPending = useMarkShipmentPickupPending(id ?? '');
  const markInTransit = useMarkShipmentInTransit(id ?? '');
  const markDeliveryPending = useMarkShipmentDeliveryPending(id ?? '');
  const requestPickupOtp = useRequestShipmentPickupOtp(id ?? '');
  const verifyPickupOtp = useVerifyShipmentPickupOtp(id ?? '');
  const requestDeliveryOtp = useRequestShipmentDeliveryOtp(id ?? '');
  const verifyDeliveryOtp = useVerifyShipmentDeliveryOtp(id ?? '');

  if (isLoading || !shipment) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
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

  const publishableTrips = (tripsPage?.data ?? []).filter((t) => t.status === 'PUBLISHED' && t.allowsShipments);
  const isUnassigned = !shipment.tripId && shipment.status === 'SEARCHING_DRIVER';
  const canCancel = !['DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'].includes(shipment.status);

  function handleAssign() {
    if (!selectedTripId) return;
    assignShipment.mutate(
      { tripId: selectedTripId },
      { onError: (error) => Alert.alert('Erreur', error instanceof ApiError ? error.message : 'Échec de l\'assignation.') },
    );
  }

  function handleCancel() {
    Alert.alert('Annuler cet envoi ?', 'Cette action ne peut pas être annulée.', [
      { text: 'Retour', style: 'cancel' },
      {
        text: "Annuler l'envoi",
        style: 'destructive',
        onPress: () =>
          cancelShipment.mutate(
            { reason: "Annulé depuis l'application" },
            { onError: () => Alert.alert('Erreur', "L'annulation a échoué.") },
          ),
      },
    ]);
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <Badge label={SHIPMENT_STATUS_LABELS[shipment.status]} tone={SHIPMENT_STATUS_TONE[shipment.status]} />
      </View>

      <Card style={styles.card}>
        <AppText variant="sm" color="textSecondary">
          {shipment.category?.name ?? 'Colis'} · {shipment.weightKg} kg
        </AppText>
        <AppText variant="lg" weight="semibold">
          {formatMoney(shipment.price)}
        </AppText>

        <Divider />

        <View style={styles.contactBlock}>
          <AppText variant="xs" color="textSecondary">
            Expéditeur
          </AppText>
          <AppText variant="sm" weight="medium">
            {shipment.senderName}
          </AppText>
          <View style={styles.metaRow}>
            <IconPhone size={12} color={colors.textSecondary} />
            <AppText variant="xs" color="textSecondary">
              {shipment.senderPhone}
            </AppText>
          </View>
          <View style={styles.metaRow}>
            <IconMapPin size={12} color={colors.textSecondary} />
            <AppText variant="xs" color="textSecondary" style={{ flex: 1 }}>
              {shipment.senderLocation?.label ?? '—'}
            </AppText>
          </View>
        </View>

        <View style={styles.contactBlock}>
          <AppText variant="xs" color="textSecondary">
            Destinataire
          </AppText>
          <AppText variant="sm" weight="medium">
            {shipment.recipientName}
          </AppText>
          <View style={styles.metaRow}>
            <IconPhone size={12} color={colors.textSecondary} />
            <AppText variant="xs" color="textSecondary">
              {shipment.recipientPhone}
            </AppText>
          </View>
          <View style={styles.metaRow}>
            <IconMapPin size={12} color={colors.textSecondary} />
            <AppText variant="xs" color="textSecondary" style={{ flex: 1 }}>
              {shipment.recipientLocation?.label ?? '—'}
            </AppText>
          </View>
        </View>
      </Card>

      {isUnassigned ? (
        <Card style={styles.card}>
          <AppText variant="base" weight="semibold" style={styles.otpTitle}>
            Assigner à un de vos trajets
          </AppText>
          {publishableTrips.length === 0 ? (
            <AppText variant="sm" color="textSecondary">
              Aucun de vos trajets publiés n'accepte les colis pour le moment.
            </AppText>
          ) : (
            <View style={styles.tripList}>
              {publishableTrips.map((trip) => {
                const isSelected = trip.id === selectedTripId;
                return (
                  <Card
                    key={trip.id}
                    onPress={() => setSelectedTripId(trip.id)}
                    style={[styles.tripOption, isSelected && styles.tripOptionActive]}
                  >
                    <AppText variant="sm" weight="medium">
                      {trip.originCity.name} → {trip.destinationCity.name}
                    </AppText>
                  </Card>
                );
              })}
            </View>
          )}
          <Button
            label="Confirmer l'assignation"
            onPress={handleAssign}
            disabled={!selectedTripId}
            loading={assignShipment.isPending}
            style={styles.assignButton}
          />
        </Card>
      ) : null}

      {shipment.status === 'DRIVER_ASSIGNED' ? (
        <Button
          label="En route pour la récupération"
          onPress={() => markPickupPending.mutate()}
          loading={markPickupPending.isPending}
          style={styles.actionButton}
        />
      ) : null}

      {shipment.status === 'PICKUP_PENDING' ? (
        <OtpSection
          title="Code de récupération"
          onRequest={() => requestPickupOtp.mutate()}
          onVerify={(code) =>
            verifyPickupOtp.mutate(code, {
              onError: (error) =>
                Alert.alert('Code invalide', error instanceof ApiError ? error.message : 'Réessayez.'),
            })
          }
          isRequesting={requestPickupOtp.isPending}
          isVerifying={verifyPickupOtp.isPending}
        />
      ) : null}

      {shipment.status === 'PICKED_UP' ? (
        <Button
          label="Démarrer le transport"
          onPress={() => markInTransit.mutate()}
          loading={markInTransit.isPending}
          style={styles.actionButton}
        />
      ) : null}

      {shipment.status === 'IN_TRANSIT' ? (
        <Button
          label="En route pour la livraison"
          onPress={() => markDeliveryPending.mutate()}
          loading={markDeliveryPending.isPending}
          style={styles.actionButton}
        />
      ) : null}

      {shipment.status === 'DELIVERY_PENDING' ? (
        <OtpSection
          title="Code de livraison"
          onRequest={() => requestDeliveryOtp.mutate()}
          onVerify={(code) =>
            verifyDeliveryOtp.mutate(code, {
              onError: (error) =>
                Alert.alert('Code invalide', error instanceof ApiError ? error.message : 'Réessayez.'),
            })
          }
          isRequesting={requestDeliveryOtp.isPending}
          isVerifying={verifyDeliveryOtp.isPending}
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
  card: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  contactBlock: {
    gap: 2,
    marginTop: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  otpTitle: {
    marginBottom: spacing.sm,
  },
  tripList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  tripOption: {
    padding: spacing.sm + 2,
  },
  tripOptionActive: {
    borderColor: colors.primary,
  },
  assignButton: {
    marginTop: spacing.xs,
  },
  otpCard: {
    marginBottom: spacing.md,
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  codeInput: {
    flex: 1,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
});
