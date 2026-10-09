// mobile/app/(customer)/booking/[id].tsx
//
// [09/10/2026] v5 — Plus d'annulation une fois pris en charge : le bouton « Annuler la réservation » disparaît dès qu'un passager
// de la réservation est monté (le serveur refuse aussi). Un court message explique pourquoi et renvoie vers « Signaler un
// problème », qui reste toujours proposé. Le message d'erreur du serveur est désormais affiché tel quel.
//
// Une fois la dépose validée (réservation terminée), un mot de bienvenue dans la ville d'arrivée s'affiche sous le statut — le même
// que celui reçu par notification et par email.
//
// [09/10/2026] v7 — Page simplifiée pendant le voyage (même esprit que le guide du conducteur) : une fois le client à bord et le
// trajet en route, on ne montre que l'essentiel — bandeau « Voyage en cours · En route vers X » à la place du statut, rappel de
// ceinture, position du conducteur, et le code de dépose à l'arrivée. Trajet, passagers et montant passent sous « Voir tous les
// détails ». Le titre de la page suit l'étape (« Mon voyage » en route, « Voyage terminé »…) au lieu de « Réservation » partout.
// « Signaler un problème » reste toujours à portée de main.
//
// [09/10/2026] v6 — Quand le client est à bord et que le trajet est en route (« les deux sont partis »), la section Trajet affiche
// « Voyage en cours », sa destination, et le rappel de ceinture de sécurité avec les vœux de bon voyage (le même texte part aussi
// par notification quand le conducteur démarre).
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
// conducteur signale ensuite son arrivée (TripsService.markArrived),
// trip.status passe à ARRIVED — valeur absente de la condition
// d'affichage de DropoffCodeCard, qui se refermait donc juste avant que
// le client en ait le plus besoin. ARRIVED est désormais inclus.

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconCash,
  IconChevronDown,
  IconChevronUp,
  IconFlag,
  IconMapPin,
  IconMessageCircle,
  IconRoute,
  IconShieldCheck,
  IconTicket,
  IconUsers,
} from '@tabler/icons-react-native';
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
import { customerCodeVisibility, isPickedUp } from '@/utils/bookingPhase';
import { closeToHome } from '@/utils/navigation';
import { ApiError } from '@/services/api/ApiError';
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

/** Le titre de la page suit l'étape : « Réservation » n'a plus de sens quand le client est en route. */
function screenTitleFor(status: BookingStatus, journeyMode: boolean): string {
  if (journeyMode) return 'Mon voyage';
  switch (status) {
    case 'PENDING_PAYMENT':
      return 'Réservation';
    case 'COMPLETED':
      return 'Voyage terminé';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'Réservation annulée';
    case 'DISPUTED':
      return 'Litige en cours';
    default:
      return 'Ma réservation';
  }
}

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
      description="Communiquez-le à votre conducteur pour confirmer votre prise en charge — envoyé par SMS, et récupérable ici si besoin (copie directe possible)."
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
      description="Communiquez-le à votre conducteur pour confirmer la fin de votre trajet — envoyé par SMS, et récupérable ici si besoin (copie directe possible)."
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
  const [showDetails, setShowDetails] = useState(false);

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
  // Pris en charge = à bord : plus d'annulation possible (le litige reste ouvert).
  const pickedUp = Boolean(booking.passengers?.some((passenger) => passenger.pickedUpAt));
  const canCancel = CANCELLABLE_STATUSES.includes(booking.status) && !pickedUp;
  const cancelLocked = CANCELLABLE_STATUSES.includes(booking.status) && pickedUp;
  // Voyage : le client est à bord ET le trajet est en route (ou arrivé). L'écran se limite alors à l'essentiel.
  const journeyMode =
    booking.status === 'CONFIRMED' && isPickedUp(booking) && (trip?.status === 'IN_PROGRESS' || trip?.status === 'ARRIVED');
  const detailsVisible = !journeyMode || showDetails;
  const arrivalCity = booking.alightingStop?.city?.name ?? trip?.destinationCity.name ?? 'destination';
  const arrived = journeyMode && showDropoffCode;
  const screenTitle = screenTitleFor(booking.status, journeyMode);
  const hasRated = (existingRatings?.length ?? 0) > 0;

  function handleConfirmCancel() {
    setCancelErrorMessage(undefined);
    cancelBooking.mutate(
      { reason: "Annulée depuis l'application" },
      {
        onSuccess: () => setConfirmCancelOpen(false),
        onError: (error) =>
          setCancelErrorMessage(error instanceof ApiError ? error.message : "L'annulation a échoué — réessayez."),
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader
        title={screenTitle}
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
              accessibilityLabel="Contacter le conducteur"
              style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}
            >
              <IconMessageCircle size={18} color={OCEAN.base} />
            </Pressable>
          )
        }
      />

      {journeyMode ? (
        // Pendant le voyage, le statut « Confirmée » n'apporte rien : le bandeau dit où l'on en est.
        <OceanHeroCard style={[styles.hero, { backgroundColor: arrived ? colors.successDeep : OCEAN.deep }]}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              {arrived ? <IconFlag size={26} color={OCEAN.onDark} /> : <IconRoute size={26} color={OCEAN.onDark} />}
            </View>
            <View style={styles.heroText}>
              <AppText variant="lg" weight="bold" color={OCEAN.onDark}>
                {arrived ? `Vous êtes arrivé à ${arrivalCity}` : 'Voyage en cours'}
              </AppText>
              <AppText variant="sm" color={OCEAN.sky}>
                {arrived ? 'Donnez votre code de dépose à votre conducteur' : `En route vers ${arrivalCity}`}
              </AppText>
            </View>
          </View>
        </OceanHeroCard>
      ) : (
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
      )}

      {booking.status === 'COMPLETED' ? (
        <OceanSection icon={<IconMapPin size={17} color={OCEAN.base} />} title="Bienvenue">
          <AppText variant="base" weight="bold" color={OCEAN.deep}>
            Bienvenue à {booking.alightingStop?.city?.name ?? trip?.destinationCity.name ?? 'destination'} !
          </AppText>
          <AppText variant="sm" color="textSecondary" style={styles.welcomeText}>
            Vous êtes bien arrivé. Toute l'équipe Occa'Z vous souhaite un excellent séjour et vous remercie d'avoir voyagé avec nous.
          </AppText>
        </OceanSection>
      ) : null}

      {journeyMode && !arrived ? (
        <View style={styles.journeyOn}>
          <IconShieldCheck size={20} color={colors.successDark} />
          <AppText variant="sm" color={colors.successDark} style={styles.journeyOnText}>
            N&apos;oubliez pas d&apos;attacher votre ceinture de sécurité. Nous vous souhaitons un bon voyage.
          </AppText>
        </View>
      ) : null}

      {trip ? <DriverPositionCard tripId={trip.id} isActive={trip.status === 'IN_PROGRESS'} /> : null}

      {showPickupCode ? <PickupCodeCard bookingId={booking.id} /> : null}

      {showDropoffCode ? <DropoffCodeCard bookingId={booking.id} /> : null}

      {detailsVisible && trip ? (
        <OceanSection icon={<IconRoute size={17} color={OCEAN.base} />} title="Trajet">
          <View style={styles.tripBlock}>
            {journeyMode ? (
              <AppText variant="xs" color="textSecondary">
                Statut de la réservation : {STATUS_LABELS[booking.status]}
              </AppText>
            ) : null}
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

      {detailsVisible && booking.passengers && booking.passengers.length > 0 ? (
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

      {detailsVisible ? (
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
      ) : null}

      {journeyMode ? (
        <OceanButton
          label={showDetails ? 'Masquer les détails' : 'Voir tous les détails'}
          variant="soft"
          icon={showDetails ? <IconChevronUp size={16} color={OCEAN.base} /> : <IconChevronDown size={16} color={OCEAN.base} />}
          onPress={() => setShowDetails((value) => !value)}
          style={styles.actionButton}
        />
      ) : null}

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

      {cancelLocked && detailsVisible ? (
        <AppText variant="xs" color="textSecondary" style={styles.cancelLockedNote}>
          Vous avez été pris en charge : l'annulation n'est plus possible. En cas de problème, utilisez « Signaler un problème ».
        </AppText>
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
  journeyOn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: 14,
    backgroundColor: colors.successLight,
  },
  journeyOnText: {
    flex: 1,
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
  welcomeText: {
    marginTop: spacing.xxs,
  },
  cancelLockedNote: {
    marginBottom: spacing.sm,
  },
  cancelError: {
    marginBottom: spacing.xs,
  },
});