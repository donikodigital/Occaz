// mobile/app/(driver)/shipment/[id].tsx
// [21/09/2026] v2 — gain net et période affichés, téléphones appelables, annulation avant récupération seulement ; l'attribution se fait depuis la liste.
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconArrowLeft,
  IconCalendarEvent,
  IconLifebuoy,
  IconMapPin,
  IconMessageCircle,
} from '@tabler/icons-react-native';
import { AppText, Badge, Button, Card, Divider, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { ContactRow } from '@/components/screens/ContactRow';
import { colors, spacing } from '@/theme';
import { useShipment, useCancelShipment } from '@/hooks/useShipments';
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
import { driverNetAmount, formatLocation, formatWindow } from '@/utils/shipmentDisplay';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_TONE } from '@/utils/tripStatusLabels';
import { useGetOrCreateConversationForShipment } from '@/hooks/useConversations';
import { ApiError } from '@/services/api/ApiError';

function OtpSection({
  title,
  onRequest,
  onVerify,
  isRequesting,
  isVerifying,
  supportPrompt,
  onContactSupport,
}: {
  title: string;
  onRequest: () => void;
  onVerify: (code: string) => void;
  isRequesting: boolean;
  isVerifying: boolean;
  /** Texte du bouton contextuel affiché une fois le code demandé (ex. « Expéditeur injoignable ? »). */
  supportPrompt: string;
  onContactSupport: () => void;
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
        <>
          <View style={styles.codeRow}>
            <TextField
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="Code à 6 chiffres"
              maxLength={6}
              // `style` ne touche que le <TextInput> interne, jamais son
              // conteneur — d'où le champ resté étroit malgré codeInput
              // (flex: 1) : ce flex n'atteignait jamais l'élément qui
              // partage réellement la rangée avec le bouton "Vérifier".
              containerStyle={styles.codeInput}
            />
            <Button
              label="Vérifier"
              fullWidth={false}
              onPress={() => onVerify(code)}
              loading={isVerifying}
              disabled={code.length !== 6}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onContactSupport}
            style={({ pressed }) => [styles.supportLink, pressed && styles.pressed]}
          >
            <IconLifebuoy size={14} color={colors.accent} />
            <AppText variant="xs" color={colors.accent} weight="semibold">
              {supportPrompt}
            </AppText>
          </Pressable>
        </>
      )}
    </Card>
  );
}

export default function DriverShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: shipment, isLoading, isError } = useShipment(id);

  const cancelShipment = useCancelShipment(id ?? '');
  const getOrCreateConversation = useGetOrCreateConversationForShipment();
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

  // Une fois le colis récupéré, l'annulation n'est plus possible (le client serait remboursé à 100 % alors que le colis est en route) : le recours est « Signaler un problème ».
  const canCancel = ['DRIVER_ASSIGNED', 'PICKUP_PENDING'].includes(shipment.status);
  const currencyCode = shipment.currency?.isoCode;

  function handleCancel() {
    Alert.alert('Annuler cet envoi ?', 'Le client sera remboursé intégralement et l\'envoi sera annulé.', [
      { text: 'Retour', style: 'cancel' },
      {
        text: "Annuler l'envoi",
        style: 'destructive',
        onPress: () =>
          cancelShipment.mutate(
            { reason: "Annulé depuis l'application" },
            {
              onError: (error) =>
                Alert.alert('Erreur', error instanceof ApiError ? error.message : "L'annulation a échoué."),
            },
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
        {shipment.driverId ? (
          <IconButton
            icon={<IconMessageCircle size={18} color={colors.textPrimary} />}
            accessibilityLabel="Contacter le client"
            onPress={() =>
              getOrCreateConversation.mutate(shipment.id, {
                onSuccess: (conversation) => router.push(`/(driver)/conversation/${conversation.id}`),
              })
            }
          />
        ) : null}
        <Badge label={SHIPMENT_STATUS_LABELS[shipment.status]} tone={SHIPMENT_STATUS_TONE[shipment.status]} />
      </View>

      <Card style={styles.card}>
        <AppText variant="sm" color="textSecondary">
          {shipment.category?.name ?? 'Colis'}, {shipment.weightKg} kg
        </AppText>
        <AppText variant="xs" color="textSecondary">
          Vous recevrez
        </AppText>
        <AppText variant="lg" weight="semibold">
          {formatMoney(driverNetAmount(shipment), currencyCode)}
        </AppText>
        <View style={styles.metaRow}>
          <IconCalendarEvent size={12} color={colors.textSecondary} />
          <AppText variant="xs" color="textSecondary">
            {formatWindow(shipment)}
          </AppText>
        </View>

        <Divider />

        <View style={styles.contactBlock}>
          <AppText variant="xs" color="textSecondary">
            Expéditeur
          </AppText>
          <AppText variant="sm" weight="medium">
            {shipment.senderName}
          </AppText>
          <ContactRow phone={shipment.senderPhone} />
          <View style={styles.metaRow}>
            <IconMapPin size={12} color={colors.textSecondary} />
            <AppText variant="xs" color="textSecondary" style={{ flex: 1 }}>
              {formatLocation(shipment.senderLocation)}
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
          <ContactRow phone={shipment.recipientPhone} />
          <View style={styles.metaRow}>
            <IconMapPin size={12} color={colors.textSecondary} />
            <AppText variant="xs" color="textSecondary" style={{ flex: 1 }}>
              {formatLocation(shipment.recipientLocation)}
            </AppText>
          </View>
        </View>
      </Card>

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
          onRequest={() =>
            requestPickupOtp.mutate(undefined, {
              onSuccess: (result) => {
                if (!result.smsSent) {
                  Alert.alert(
                    'Code généré',
                    "Le SMS n'a pas pu être envoyé à l'expéditeur — demandez-lui de consulter son code directement dans l'application.",
                  );
                }
              },
            })
          }
          onVerify={(code) =>
            verifyPickupOtp.mutate(code, {
              onError: (error) =>
                Alert.alert('Code invalide', error instanceof ApiError ? error.message : 'Réessayez.'),
            })
          }
          isRequesting={requestPickupOtp.isPending}
          isVerifying={verifyPickupOtp.isPending}
          supportPrompt="Expéditeur injoignable ou refuse le code ? Contacter le support"
          onContactSupport={() =>
            router.push({
              pathname: '/(driver)/dispute-new',
              params: {
                subjectType: 'SHIPMENT',
                shipmentId: shipment.id,
                reason: 'Expéditeur injoignable ou refuse de communiquer le code de récupération',
                description: `Colis pour ${shipment.recipientName}.`,
              },
            })
          }
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
          onRequest={() =>
            requestDeliveryOtp.mutate(undefined, {
              onSuccess: (result) => {
                if (!result.smsSent) {
                  Alert.alert(
                    'Code généré',
                    "Le SMS n'a pas pu être envoyé au destinataire — contrairement à l'expéditeur, il n'a pas de compte dans l'application pour le consulter autrement. Réessayez ou contactez-le directement.",
                  );
                }
              },
            })
          }
          onVerify={(code) =>
            verifyDeliveryOtp.mutate(code, {
              onError: (error) =>
                Alert.alert('Code invalide', error instanceof ApiError ? error.message : 'Réessayez.'),
            })
          }
          isRequesting={requestDeliveryOtp.isPending}
          isVerifying={verifyDeliveryOtp.isPending}
          supportPrompt="Destinataire injoignable ou refuse le code ? Contacter le support"
          onContactSupport={() =>
            router.push({
              pathname: '/(driver)/dispute-new',
              params: {
                subjectType: 'SHIPMENT',
                shipmentId: shipment.id,
                reason: 'Destinataire injoignable ou refuse de communiquer le code de livraison',
                description: `Colis de ${shipment.senderName} pour ${shipment.recipientName}.`,
              },
            })
          }
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

      <Button
        label="Signaler un problème"
        variant="ghost"
        onPress={() =>
          router.push({
            pathname: '/(driver)/dispute-new',
            params: { subjectType: 'SHIPMENT', shipmentId: shipment.id },
          })
        }
        style={styles.actionButton}
      />
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
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
});