// mobile/app/(customer)/booking/[id].tsx
//
// v3 — Habillage bleu océan, sur le modèle du suivi d'envoi : bandeau de
// statut coloré (bleu en cours, vert confirmé ou terminé, gris annulé, rouge
// litige), carte du trajet, passagers, détail du prix, et les actions
// (payer, noter, annuler, signaler) en boutons pleins. Logique inchangée.
//
// v2 — Alert.alert() ne s'affiche pas sur le web (react-native-web ne
// l'implémente pas) : le bouton "Annuler la réservation" semblait ne
// rien faire. Remplacé par ConfirmDialog (nouveau composant, même
// famille que CalendarPicker/TimePicker) pour la confirmation, et par
// un message d'erreur en ligne pour l'échec d'annulation — même souci
// sur le second Alert.alert (celui d'erreur), corrigé par la même
// occasion plutôt que de laisser un piège identique juste après.
//
// v4 — Le code de dépose disparaissait exactement au moment de l'arrivée :
// TripOtpService.markPickedUp génère et envoie ce code dès la prise en
// charge (trip.status encore à PASSENGER_PICKED_UP), mais quand le
// chauffeur signale ensuite son arrivée (TripsService.markArrived),
// trip.status passe à ARRIVED — valeur absente de la condition
// d'affichage de DropoffCodeCard, qui se refermait donc juste avant que
// le client en ait le plus besoin. ARRIVED est désormais inclus.

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconCash, IconMessageCircle, IconRoute, IconTicket, IconUsers } from '@tabler/icons-react-native';
import { AppText, ConfirmDialog, DriverPositionCard, ScreenContainer } from '@/components/ui';
import { ContactRow } from '@/components/screens/ContactRow';
import { OtpCodeCard } from '@/components/screens/OtpCodeCard';
import { OceanButton, OceanHeroCard, OceanScreenHeader, OceanSection } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import {
  useBooking,
  useCancelBooking,
  useRevealDropoffOtpForCustomer,
  useRevealPickupOtpForCustomer,
} from '@/hooks/useBookings';
import { useBookingRatings } from '@/hooks/useRatings';
import { useGetOrCreateConversationForBooking } from '@/hooks/useConversations';
import { currencyOf, formatMoney } from '@/utils/money';
import { formatDateLong, formatTime } from '@/utils/date';
import { bookingBoardingAt, bookingRouteLabel, isPartialBooking } from '@/utils/tripSegment';
import { customerCodeVisibility } from '@/utils/bookingPhase';
import { closeToHome } from '@/utils/navigation';
import type { BookingStatus } from '@/types/bookings.types';

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Terminée',
  REFUNDED: 'Remboursée',
  DISPUTED: 'En litige',
};

const CANCELLABLE_STATUSES: BookingStatus[] = ['PENDING_PAYMENT', 'PAID', 'CONFIRMED'];

/** La couleur du bandeau raconte l'état de la réservation au premier coup d'œil. */
function heroColorFor(status: BookingStatus): string {
  if (status === 'CONFIRMED' || status === 'COMPLETED') return colors.successDeep;
  if (status === 'CANCELLED' || status === 'REFUNDED') return colors.textSecondary;
  if (status === 'DISPUTED') return colors.danger;
  return OCEAN.deep;
}

function PickupCodeCard({ bookingId }: { bookingId: string }) {
  const reveal = useRevealPickupOtpForCustomer(bookingId);
  return (
    <OtpCodeCard
      title="Code de prise en charge"
      description="Communiquez-le à votre chauffeur pour confirmer votre prise en charge — envoyé par SMS, et récupérable ici si besoin (copie directe possible)."
      code={reveal.data?.code}
      smsSent={reveal.data?.smsSent}
      isPending={reveal.isPending}
      isError={reveal.isError}
      error={reveal.error}
      onRequest={() => reveal.mutate()}
    />
  );
}

function DropoffCodeCard({ bookingId }: { bookingId: string }) {
  const reveal = useRevealDropoffOtpForCustomer(bookingId);
  return (
    <OtpCodeCard
      title="Code de dépose"
      description="Communiquez-le à votre chauffeur pour confirmer la fin de votre trajet — envoyé par SMS, et récupérable ici si besoin (copie directe possible)."
      code={reveal.data?.code}
      smsSent={reveal.data?.smsSent}
      isPending={reveal.isPending}
      isError={reveal.isError}
      error={reveal.error}
      onRequest={() => reveal.mutate()}
    />
  );
}

export default function BookingDetailScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { data: booking, isLoading, isError } = useBooking(id);
  const cancelBooking = useCancelBooking(id ?? '');
  const { data: existingRatings } = useBookingRatings(id);
  const getOrCreateConversation = useGetOrCreateConversationForBooking();

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelErrorMessage, setCancelErrorMessage] = useState<string | undefined>();

  if (isLoading || !booking) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
        {isError ? (
          <AppText variant="sm" color="danger">
            Impossible de charger cette réservation.
          </AppText>
        ) : (
          <ActivityIndicator color={OCEAN.base} />
        )}
      </ScreenContainer>
    );
  }

  const trip = booking.trip;

  // Codes à montrer : voir customerCodeVisibility. Le code de dépose s'affiche même si la prise en charge a été oubliée par le
  // conducteur (jamais de client coincé à l'arrivée) ; celui de prise en charge d'un client d'étape, seulement en route, une fois
  // le conducteur arrivé à son étape.
  const { pickup: showPickupCode, dropoff: showDropoffCode } = customerCodeVisibility(booking, trip?.status);
  const canCancel = CANCELLABLE_STATUSES.includes(booking.status);
  const hasRated = (existingRatings?.length ?? 0) > 0;

  function handleConfirmCancel() {
    setCancelErrorMessage(undefined);
    cancelBooking.mutate(
      { reason: "Annulée depuis l'application" },
      {
        onSuccess: () => setConfirmCancelOpen(false),
        onError: () => setCancelErrorMessage("L'annulation a échoué — réessayez."),
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader
        title="Réservation"
        subtitle={bookingRouteLabel(booking)}
        onBack={() => router.back()}
        // Affiché juste après la réservation ou le paiement : une croix qui revient à l'accueil, pas la flèche vers les étapes d'avant.
        onClose={created ? () => closeToHome('/(customer)/(tabs)/home') : undefined}
        // Trajet terminé : plus de messagerie avec le conducteur (comme l'appel et le SMS, retirés par le serveur, qui refuse aussi les
        // nouveaux messages). En cas de problème : « Signaler un problème ».
        right={
          booking.status === 'COMPLETED' ? undefined : (
            <Pressable
              onPress={() =>
                getOrCreateConversation.mutate(booking.id, {
                  onSuccess: (conversation) => router.push(`/(customer)/conversation/${conversation.id}`),
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Contacter le chauffeur"
              style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
            >
              <IconMessageCircle size={18} color={OCEAN.base} />
            </Pressable>
          )
        }
      />

      <OceanHeroCard style={[styles.hero, { backgroundColor: heroColorFor(booking.status) }]}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <IconTicket size={26} color={OCEAN.onDark} />
          </View>
          <View style={styles.heroText}>
            <AppText variant="xs" color={OCEAN.sky}>
              Statut de la réservation
            </AppText>
            <AppText variant="lg" weight="bold" color={OCEAN.onDark}>
              {STATUS_LABELS[booking.status]}
            </AppText>
          </View>
        </View>
      </OceanHeroCard>

      {trip ? <DriverPositionCard tripId={trip.id} isActive={trip.status === 'IN_PROGRESS'} /> : null}

      {trip ? (
        <OceanSection icon={<IconRoute size={17} color={OCEAN.base} />} title="Trajet">
          <View style={styles.tripBlock}>
            <AppText variant="base" weight="bold" color={OCEAN.deep}>
              {bookingRouteLabel(booking)}
            </AppText>
            {isPartialBooking(booking) ? (
              <AppText variant="xs" color="textSecondary">
                Trajet du conducteur : {trip.originCity.name} → {trip.destinationCity.name}
              </AppText>
            ) : null}
            <AppText variant="sm" weight="semibold">
              {formatDateLong(bookingBoardingAt(booking) ?? trip.departureAt)} à {formatTime(bookingBoardingAt(booking) ?? trip.departureAt)}
            </AppText>
            <AppText variant="sm" color="textSecondary">
              {trip.driver.firstName} {trip.driver.lastName[0]}. · {trip.vehicle.brand} {trip.vehicle.model}
            </AppText>
            {booking.driverPhone ? (
              <ContactRow phone={booking.driverPhone} style={styles.contactRow} />
            ) : null}
          </View>
        </OceanSection>
      ) : null}

      {showPickupCode ? <PickupCodeCard bookingId={booking.id} /> : null}

      {showDropoffCode ? <DropoffCodeCard bookingId={booking.id} /> : null}

      {booking.passengers && booking.passengers.length > 0 ? (
        <OceanSection icon={<IconUsers size={17} color={OCEAN.base} />} title="Passagers">
          <View style={styles.passengers}>
            {booking.passengers.map((passenger) => (
              <View key={passenger.id} style={styles.passengerRow}>
                <View style={styles.passengerDot} />
                <AppText variant="sm" weight="semibold">
                  {passenger.fullName}
                </AppText>
              </View>
            ))}
          </View>
        </OceanSection>
      ) : null}

      <OceanSection icon={<IconCash size={17} color={OCEAN.base} />} title="Montant">
        <View style={styles.priceRows}>
          <View style={styles.totalRow}>
            <AppText variant="base" weight="bold">
              {booking.seatsCount} place{booking.seatsCount > 1 ? 's' : ''}
            </AppText>
            <AppText variant="lg" weight="bold" color={OCEAN.deep}>
              {formatMoney(booking.totalAmount, currencyOf(booking))}
            </AppText>
          </View>
        </View>
      </OceanSection>

      {booking.status === 'PENDING_PAYMENT' ? (
        <OceanButton
          label="Payer maintenant"
          onPress={() => router.push({ pathname: '/(customer)/payment', params: { bookingId: booking.id } })}
          style={styles.actionButton}
        />
      ) : null}

      {booking.status === 'COMPLETED' && !hasRated ? (
        <OceanButton
          label="Noter ce trajet"
          variant="soft"
          onPress={() => router.push({ pathname: '/(customer)/rate', params: { type: 'booking', id: booking.id } })}
          style={styles.actionButton}
        />
      ) : null}

      {canCancel ? (
        <>
          {cancelErrorMessage ? (
            <AppText variant="sm" color="danger" style={styles.cancelError}>
              {cancelErrorMessage}
            </AppText>
          ) : null}
          <OceanButton
            label="Annuler la réservation"
            variant="outline"
            onPress={() => {
              setCancelErrorMessage(undefined);
              setConfirmCancelOpen(true);
            }}
            style={styles.actionButton}
          />
        </>
      ) : null}

      <OceanButton
        label="Signaler un problème"
        variant="soft"
        onPress={() =>
          router.push({
            pathname: '/(customer)/dispute-new',
            params: { subjectType: 'TRIP', bookingId: booking.id },
          })
        }
        style={styles.actionButton}
      />

      <ConfirmDialog
        visible={confirmCancelOpen}
        title="Annuler la réservation ?"
        message="Cette action ne peut pas être annulée."
        confirmLabel="Annuler la réservation"
        destructive
        loading={cancelBooking.isPending}
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmCancelOpen(false)}
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
  tripBlock: {
    gap: 3,
  },
  contactRow: {
    marginTop: spacing.xs,
  },
  passengers: {
    gap: spacing.xs,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  passengerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: OCEAN.bright,
  },
  priceRows: {
    gap: spacing.xs + 2,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: OCEAN.line,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
  cancelError: {
    marginBottom: spacing.xs,
  },
});