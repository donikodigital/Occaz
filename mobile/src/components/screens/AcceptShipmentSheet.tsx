// mobile/src/components/screens/AcceptShipmentSheet.tsx
// [21/09/2026] v1 — feuille d'acceptation : gain net, colis, choix d'un trajet ou « sans trajet précis ».
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconBolt, IconCalendarEvent, IconCheck, IconLock, IconRoute, IconRuler2, IconWeight, IconX } from '@tabler/icons-react-native';
import { AppText, Badge, Button, IconButton } from '@/components/ui';
import { colors, maxContentWidth, radius, spacing } from '@/theme';
import { useMyTrips } from '@/hooks/useDriverTrips';
import { useAssignShipment } from '@/hooks/useDriverShipments';
import { ApiError } from '@/services/api/ApiError';
import { formatDateShort, formatTime } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { driverNetAmount, formatDimensions, formatWindow, getEligibleTrips, isSameRoute } from '@/utils/shipmentDisplay';
import type { AvailableShipment } from '@/types/shipments.types';
import type { Trip } from '@/types/trips.types';
import { FactChip, ShipmentRoute } from './ShipmentParts';

export interface AcceptShipmentSheetProps {
  shipment: AvailableShipment | null;
  onClose: () => void;
  /** Appelé une fois l'envoi attribué — l'écran de détail affiche alors les coordonnées du client. */
  onAccepted: (shipmentId: string) => void;
  /** Appelé si l'acceptation échoue (souvent : un autre chauffeur a été plus rapide) — sert à rafraîchir la liste. */
  onAttemptFailed?: () => void;
}

/** Valeur de choix "sans trajet" — jamais un identifiant réel de trajet. */
const NO_TRIP = 'no-trip';

/** Un chauffeur validé peut accepter sans avoir de trajet établi : il récupère et livre le colis dans la période demandée. */
function NoTripOption({ shipment, selected, onPress }: { shipment: AvailableShipment; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.tripOption, selected && styles.tripOptionActive, pressed && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected ? <IconCheck size={12} color={colors.onPrimary} strokeWidth={3} /> : null}
      </View>
      <View style={styles.tripText}>
        <AppText variant="sm" weight="semibold">
          Sans trajet précis
        </AppText>
        <AppText variant="xs" color="textSecondary">
          Vous récupérez et livrez le colis pendant la période demandée. {formatWindow(shipment)}.
        </AppText>
      </View>
    </Pressable>
  );
}

function TripOption({
  trip,
  shipment,
  selected,
  onPress,
}: {
  trip: Trip;
  shipment: AvailableShipment;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.tripOption, selected && styles.tripOptionActive, pressed && styles.pressed]}
    >
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected ? <IconCheck size={12} color={colors.onPrimary} strokeWidth={3} /> : null}
      </View>
      <View style={styles.tripText}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {trip.originCity.name} → {trip.destinationCity.name}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {formatDateShort(trip.departureAt)} à {formatTime(trip.departureAt)}
          {trip.availableShipmentWeightKg !== null ? `, ${trip.availableShipmentWeightKg} kg disponibles` : ''}
        </AppText>
      </View>
      {isSameRoute(trip, shipment) ? <Badge label="Même itinéraire" tone="success" /> : null}
    </Pressable>
  );
}

function AcceptShipmentContent({
  shipment,
  onClose,
  onAccepted,
  onAttemptFailed,
}: {
  shipment: AvailableShipment;
  onClose: () => void;
  onAccepted: (shipmentId: string) => void;
  onAttemptFailed?: () => void;
}) {
  const { data: tripsPage, isLoading: tripsLoading } = useMyTrips();
  const assignShipment = useAssignShipment(shipment.id);
  const [selection, setSelection] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const eligibleTrips = getEligibleTrips(tripsPage?.data ?? [], shipment);
  // Sans choix explicite (ou si le trajet choisi n'est plus éligible), on retient le meilleur trajet — itinéraire identique puis départ le plus proche — et à défaut "sans trajet".
  const activeChoice =
    selection === NO_TRIP || eligibleTrips.some((trip) => trip.id === selection)
      ? (selection as string)
      : (eligibleTrips[0]?.id ?? NO_TRIP);
  const dimensions = formatDimensions(shipment);

  function handleConfirm() {
    setErrorMessage(undefined);
    assignShipment.mutate(
      activeChoice === NO_TRIP ? {} : { tripId: activeChoice },
      {
        onSuccess: () => onAccepted(shipment.id),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : "L'acceptation a échoué. Réessayez.");
          onAttemptFailed?.();
        },
      },
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.topBar}>
            <AppText variant="lg" weight="semibold">
              Accepter cet envoi
            </AppText>
            <IconButton
              icon={<IconX size={18} color={colors.textPrimary} />}
              accessibilityLabel="Fermer"
              onPress={onClose}
            />
          </View>

          <View style={styles.earnings}>
            <AppText variant="sm" weight="medium" color="successDark">
              Vous recevrez
            </AppText>
            <AppText variant="display" weight="bold" color="successDark">
              {formatMoney(driverNetAmount(shipment), shipment.currencyCode)}
            </AppText>
            <View style={styles.earningsNote}>
              <IconCheck size={14} color={colors.successDark} />
              <AppText variant="xs" color="successDark" style={styles.flex}>
                Le client a déjà payé. Le montant est crédité dès que le destinataire vous donne son code de livraison.
              </AppText>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AppText variant="md" weight="semibold" style={styles.flex}>
                {shipment.category.name}
              </AppText>
              {shipment.isUrgent ? (
                <Badge label="Urgent" tone="danger" icon={<IconBolt size={12} color={colors.dangerDark} />} />
              ) : null}
            </View>

            <ShipmentRoute from={shipment.senderLocation.label} to={shipment.recipientLocation.label} />

            <View style={styles.windowRow}>
              <IconCalendarEvent size={14} color={colors.textSecondary} />
              <AppText variant="sm" color="textSecondary">
                {formatWindow(shipment)}
              </AppText>
            </View>

            <View style={styles.facts}>
              <FactChip icon={<IconWeight size={13} color={colors.textSecondary} />} label={`${shipment.weightKg} kg`} />
              {dimensions ? (
                <FactChip icon={<IconRuler2 size={13} color={colors.textSecondary} />} label={dimensions} />
              ) : null}
              {shipment.quantity > 1 ? <FactChip label={`${shipment.quantity} colis`} /> : null}
            </View>

            {shipment.description ? (
              <AppText variant="sm" color="textSecondary">
                {shipment.description}
              </AppText>
            ) : null}

            <View style={styles.privacy}>
              <IconLock size={14} color={colors.textSecondary} />
              <AppText variant="xs" color="textSecondary" style={styles.flex}>
                Nom et téléphone de l&apos;expéditeur et du destinataire vous sont communiqués dès que vous acceptez.
              </AppText>
            </View>
          </View>

          <View style={styles.section}>
            <AppText variant="md" weight="semibold">
              Comment le transporter ?
            </AppText>

            {tripsLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <View accessibilityRole="radiogroup" style={styles.tripList}>
                {eligibleTrips.map((trip) => (
                  <TripOption
                    key={trip.id}
                    trip={trip}
                    shipment={shipment}
                    selected={trip.id === activeChoice}
                    onPress={() => setSelection(trip.id)}
                  />
                ))}
                <NoTripOption
                  shipment={shipment}
                  selected={activeChoice === NO_TRIP}
                  onPress={() => setSelection(NO_TRIP)}
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={styles.footerInner}>
          {errorMessage ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <AppText variant="sm" color="dangerDark">
                {errorMessage}
              </AppText>
            </View>
          ) : null}
          <Button
            label="Accepter l'envoi"
            onPress={handleConfirm}
            disabled={tripsLoading}
            loading={assignShipment.isPending}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Feuille d'acceptation d'une demande d'envoi, ouverte depuis la liste des
 * envois disponibles. Réunit ce qu'il faut pour décider en quelques
 * secondes (gain net, colis, trajet à utiliser) — premier arrivé, premier
 * servi. Monté avec `key={shipment.id}` pour repartir d'un état vierge à
 * chaque envoi.
 */
export function AcceptShipmentSheet({ shipment, onClose, onAccepted, onAttemptFailed }: AcceptShipmentSheetProps) {
  if (!shipment) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <AcceptShipmentContent
        key={shipment.id}
        shipment={shipment}
        onClose={onClose}
        onAccepted={onAccepted}
        onAttemptFailed={onAttemptFailed}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  inner: {
    width: '100%',
    maxWidth: maxContentWidth.form,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earnings: {
    gap: 2,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.successLight,
  },
  earningsNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  tripList: {
    gap: spacing.xs,
  },
  tripOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tripOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pressed: {
    opacity: 0.8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  tripText: {
    flex: 1,
    gap: 2,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footer: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerInner: {
    width: '100%',
    maxWidth: maxContentWidth.form,
    alignSelf: 'center',
    gap: spacing.sm,
  },
  errorBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerLight,
  },
});