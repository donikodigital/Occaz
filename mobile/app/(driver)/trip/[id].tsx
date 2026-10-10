// mobile/app/(driver)/trip/[id].tsx
// [10/10/2026] v+ — Plus aucun Alert.alert (sans effet sur le web) : erreurs en bannière dans la page, « Retirer une ville », « Annuler le trajet » et « Prise en charge non validée » en boîte de confirmation. Une action du trajet qui échoue (publier, démarrer…) affiche maintenant son erreur au lieu de ne rien faire.
//
// [09/10/2026] v10 — Trajet en brouillon ou publié sans réservation : même simplification que le guide. L'écran ne montre que le billet
// et l'action à faire (« Publier le trajet »). Villes traversées, colis, passagers, véhicule et annulation passent sous « Voir tous
// les détails ». Plus de section « Passagers · Aucune réservation confirmée » sur un brouillon (rien ne peut être réservé avant la
// publication), et l'ajout d'une ville traversée (avec ses adresses récentes) ne se déplie que sur demande.
//
// [09/10/2026] v9 — Guide pas à pas : dès qu'un trajet publié a une réservation payée, l'écran ne montre QUE l'étape à faire
// (DriverJourneyGuide : en route → arrivée → code → en route → … → clôture), avec un seul bouton à la fois. Fini les deux boutons
// « Je suis arrivé à Mamou » et « Signaler l'arrivée à destination » affichés ensemble. Tout le reste (billet, villes traversées,
// passagers, véhicule) se consulte sous « Voir tous les détails », en lecture seule : on n'avance que par le guide.
// [08/10/2026] v8 — « Signaler mon arrivée au départ » n'apparaît plus tant qu'aucune réservation n'existe : sans passager il n'y a personne à
// attendre, et passer en « arrivé » ferme les réservations (elles ne sont prises que sur un trajet publié) sans permettre de démarrer.
// Le trajet publié sans réservation explique maintenant qu'il attend ses premiers passagers.
// [03/10/2026] v6 — Villes traversées : section « Villes traversées » (heure de passage et prix de chaque étape, modifiables
// tant que le trajet est en brouillon ; en route, bouton « Je suis arrivé à … » qui prévient les clients de l'étape), lien
// « Colis sur ce trajet », et chaque client affiche son tronçon (« Kindia → Labé »). La prise en charge d'un client qui monte
// à une étape se valide en route, une fois arrivé à son étape ; sa dépose, à son étape de descente.
// [03/10/2026] v7 — Places par tronçon : sous les villes traversées, « Places libres par tronçon » montre où il reste de la
// place (un siège pris de Conakry à Kindia est de nouveau libre de Kindia à Labé) ; « Places » du billet vaut pour le trajet entier.
//
// v5 — stageCard et bookingCard n'avaient aucun padding défini dans leur
// style (seulement gap/marginBottom), contrairement aux autres cartes de
// l'app (ex. infoCard dans shipment/[id].tsx, qui pose explicitement
// padding: spacing.md) — OceanCard n'ajoute pas de padding par défaut,
// c'est à chaque écran de le fournir. Résultat : le texte ("Prise en
// charge", "Fatoumata DIALLO") et l'icône de "Signaler un problème"
// touchaient les bords arrondis de la carte. padding: spacing.md ajouté
// aux deux.
//
// v4 — Corrige un vrai blocage : un trajet DRIVER_ARRIVED sans aucun
// passager (0 réservation) affichait « Demandez le code de chaque
// passager » — un texte qui n'a pas de sens sans passager — et le
// bouton « Annuler le trajet » disparaissait à cette étape (il n'était
// visible que pour DRAFT/PUBLISHED). Le conducteur n'avait alors plus
// aucun moyen d'avancer ni d'annuler. La carte d'étape explique
// maintenant honnêtement la situation, et le bouton d'annulation reste
// disponible jusqu'à DRIVER_ARRIVED inclus (pas au-delà : une fois un
// passager pris en charge, annuler d'un simple bouton n'est plus
// approprié — ça relève d'un signalement, pas d'une annulation propre).
//
// v3 — Habillage bleu océan, comme l'espace client : en-tête OceanScreenHeader,
// billet dont le bandeau par défaut passe du indigo au bleu profond (OCEAN.deep),
// sections « Passagers » et « Détails » en OceanSection (même en-tête souligné
// que le profil et les envois), boutons et pastilles Ocean. Logique métier et
// structure du billet (coupon détachable, pastilles de sièges) inchangées.

import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCar,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconFlag,
  IconInfoCircle,
  IconLifebuoy,
  IconLuggage,
  IconMapPin,
  IconMessageCircle,
  IconNotes,
  IconPackage,
  IconPencil,
  IconRoute,
  IconUsers,
  IconX,
} from '@tabler/icons-react-native';
import { AppText, ConfirmDialog, FeedbackBanner, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { ContactRow } from '@/components/screens/ContactRow';
import { DriverJourneyGuide } from '@/components/screens/DriverJourneyGuide';
import { LocationAutocompleteField } from '@/components/screens/LocationAutocompleteField';
import { OceanButton, OceanCard, OceanPill, OceanScreenHeader, OceanSection, type OceanPillTone } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useTrip } from '@/hooks/useTripSearch';
import { useTripPositionBroadcast } from '@/hooks/useTripPositionBroadcast';
import { useTripPriceGuidance } from '@/hooks/useTripPriceGuidance';
import {
  useAddTripStop,
  useCancelTrip,
  useCompleteTrip,
  useMarkArrivedAtStop,
  useMarkDriverArrived,
  useMarkTripArrived,
  usePublishTrip,
  useRemoveTripStop,
  useStartTrip,
  useTripBookings,
  useUpdateTripStop,
} from '@/hooks/useDriverTrips';
import {
  useRequestDropoffOtp,
  useRequestPickupOtp,
  useVerifyDropoffOtp,
  useVerifyPickupOtp,
} from '@/hooks/useBookings';
import { useGetOrCreateConversationForBooking } from '@/hooks/useConversations';
import { currencyOf, formatMoney } from '@/utils/money';
import { formatSeatsAvailability } from '@/utils/seats';
import { formatDateLong, formatTime } from '@/utils/date';
import { DRIVER_BOOKING_STATUS_LABELS, TRIP_STATUS_LABELS } from '@/utils/tripStatusLabels';
import { bookingRoute, isPartialBooking, stopAddress, stopName } from '@/utils/tripSegment';
import { insertionSequence } from '@/utils/routeOrder';
import { closeToHome } from '@/utils/navigation';
import { describeUnpicked, getBookingPhase, isPickupMissed, unpickedBoarders, type BookingPhase } from '@/utils/bookingPhase';
import { isGuidedTrip } from '@/utils/driverJourney';
import { ApiError } from '@/services/api/ApiError';
import type { Booking } from '@/types/bookings.types';
import type { Trip, TripLocation, TripStatus, TripStop } from '@/types/trips.types';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

const HERO_MUTED = OCEAN.sky;
const HERO_SOFT = 'rgba(255,255,255,0.18)';
const MAX_SEAT_DOTS = 10;

const STATUS_PILL_TONE: Record<TripStatus, OceanPillTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'ocean',
  BOOKING_PENDING: 'ocean',
  CONFIRMED: 'ocean',
  DRIVER_ARRIVED: 'ocean',
  PASSENGER_PICKED_UP: 'ocean',
  IN_PROGRESS: 'ocean',
  ARRIVED: 'ocean',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  DISPUTED: 'danger',
  REFUNDED: 'neutral',
};

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function formatKg(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** La couleur du bandeau raconte l'état du trajet au premier coup d'œil — bleu profond pour un trajet actif, comme le reste de l'espace conducteur. */
function heroColorFor(status: TripStatus): string {
  switch (status) {
    case 'COMPLETED':
      return colors.successDeep;
    case 'CANCELLED':
    case 'REFUNDED':
      return colors.textSecondary;
    case 'DISPUTED':
      return colors.danger;
    default:
      return OCEAN.deep;
  }
}

type StageTone = 'ocean' | 'success' | 'gold';

interface Stage {
  icon: IconComponent;
  title: string;
  text: string;
  tone: StageTone;
}

const STAGE_TONES: Record<StageTone, { background: string; foreground: string }> = {
  ocean: { background: OCEAN.mist, foreground: OCEAN.base },
  success: { background: colors.successLight, foreground: colors.successDark },
  gold: { background: OCEAN.goldSoft, foreground: OCEAN.goldInk },
};

function getStage(
  status: TripStatus,
  hasBookings: boolean,
  positionError: string | null | undefined,
  positionMode: string | null | undefined,
  onlyStopBookings = false,
): Stage | null {
  switch (status) {
    case 'DRAFT':
      return {
        icon: IconNotes,
        title: 'Trajet en brouillon',
        text: 'Publiez-le pour que les passagers puissent réserver.',
        tone: 'gold',
      };
    case 'PUBLISHED':
      return hasBookings
        ? {
            icon: IconCircleCheck,
            title: 'Trajet publié',
            text: 'Rendez-vous au point de départ, puis signalez votre arrivée.',
            tone: 'ocean',
          }
        : {
            icon: IconUsers,
            title: 'En attente de réservations',
            text: 'Votre trajet est visible des passagers. Le bouton « Signaler mon arrivée au départ » apparaîtra dès la première réservation.',
            tone: 'ocean',
          };
    case 'DRIVER_ARRIVED':
      if (onlyStopBookings) {
        return {
          icon: IconRoute,
          title: 'Personne ne monte au départ',
          text: 'Vos clients vous attendent aux villes traversées : démarrez le trajet et signalez votre arrivée à chaque étape.',
          tone: 'ocean',
        };
      }
      return hasBookings
        ? {
            icon: IconUsers,
            title: 'Prise en charge',
            text: 'Demandez le code de chaque passager pour valider sa montée.',
            tone: 'ocean',
          }
        : {
            icon: IconInfoCircle,
            title: 'Aucun passager pour l’instant',
            text: 'Personne n’a réservé ce trajet, et les réservations ne sont plus ouvertes une fois votre arrivée signalée — vous pouvez l’annuler ci-dessous.',
            tone: 'gold',
          };
    case 'PASSENGER_PICKED_UP':
      return {
        icon: IconCar,
        title: 'Passagers à bord',
        text: 'Tout le monde est monté : vous pouvez démarrer le trajet.',
        tone: 'success',
      };
    case 'IN_PROGRESS':
      if (positionError) {
        return { icon: IconInfoCircle, title: 'Position non partagée', text: positionError, tone: 'gold' };
      }
      return {
        icon: IconRoute,
        title: 'En route',
        text:
          positionMode === 'background'
            ? 'Votre position est partagée avec le passager, même en arrière-plan.'
            : "Votre position est partagée avec le passager tant que l'application reste ouverte.",
        tone: 'success',
      };
    case 'ARRIVED':
      return hasBookings
        ? {
            icon: IconFlag,
            title: 'Dépose des passagers',
            text: 'Validez la dépose de chaque passager avec son code.',
            tone: 'ocean',
          }
        : {
            icon: IconFlag,
            title: 'Arrivé à destination',
            text: 'Il ne reste plus qu’à clôturer le trajet.',
            tone: 'success',
          };
    case 'COMPLETED':
      return { icon: IconCircleCheck, title: 'Trajet terminé', text: 'Ce trajet est clôturé.', tone: 'success' };
    case 'CANCELLED':
      return { icon: IconInfoCircle, title: 'Trajet annulé', text: 'Ce trajet a été annulé.', tone: 'gold' };
    default:
      return null;
  }
}

interface StageAction {
  label: string;
  run: () => void;
  isPending: boolean;
}

// ---------------------------------------------------------------------------
// Petits composants
// ---------------------------------------------------------------------------

/** Une pastille par siège : pleine = plus disponible, vide = libre (déduit du compteur de places du trajet). */
function SeatDots({ total, available }: { total: number; available: number }) {
  if (total > MAX_SEAT_DOTS || total < 1) return null;
  const taken = Math.min(Math.max(total - available, 0), total);
  return (
    <View style={styles.seatDots}>
      {Array.from({ length: total }).map((_, index) => (
        <View key={index} style={[styles.seatDot, index < taken && styles.seatDotTaken]} />
      ))}
    </View>
  );
}

function RouteStop({ eyebrow, city, address }: { eyebrow: string; city: string; address?: string }) {
  return (
    <View style={styles.stop}>
      <AppText variant="xs" color={HERO_MUTED}>
        {eyebrow}
      </AppText>
      <AppText variant="lg" weight="bold" color={colors.onPrimary} numberOfLines={1}>
        {city}
      </AppText>
      {address ? (
        <AppText variant="xs" color={HERO_MUTED} numberOfLines={2}>
          {address}
        </AppText>
      ) : null}
    </View>
  );
}

function Chip({ icon: Icon, label, active }: { icon: IconComponent; label: string; active: boolean }) {
  return (
    <View style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}>
      <Icon size={14} color={active ? OCEAN.base : colors.textMuted} />
      <AppText variant="xs" weight="medium" color={active ? OCEAN.base : colors.textMuted}>
        {label}
      </AppText>
    </View>
  );
}

function StageCard({ stage, action }: { stage: Stage; action: StageAction | null }) {
  const tone = STAGE_TONES[stage.tone];
  const Icon = stage.icon;
  return (
    <OceanCard style={styles.stageCard}>
      <View style={styles.stageHeader}>
        <View style={[styles.stageIcon, { backgroundColor: tone.background }]}>
          <Icon size={20} color={tone.foreground} />
        </View>
        <View style={styles.stageText}>
          <AppText variant="base" weight="semibold">
            {stage.title}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {stage.text}
          </AppText>
        </View>
      </View>
      {action ? <OceanButton label={action.label} onPress={action.run} loading={action.isPending} style={styles.stageButton} /> : null}
    </OceanCard>
  );
}

function BookingOtpCard({
  booking,
  tripId,
  phase,
  pickupMissed = false,
}: {
  booking: Booking;
  tripId: string;
  phase: BookingPhase;
  /** La dépose est proposée alors que la prise en charge de ce passager n'a jamais été validée. */
  pickupMissed?: boolean;
}) {
  const [codeVisible, setCodeVisible] = useState(false);
  const [code, setCode] = useState('');
  // Message affiché dans la carte (Alert.alert ne fait rien sur le web).
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'info'; title: string; text: string } | null>(null);

  const requestPickup = useRequestPickupOtp(booking.id, tripId);
  const verifyPickup = useVerifyPickupOtp(booking.id, tripId);
  const requestDropoff = useRequestDropoffOtp(booking.id, tripId);
  const verifyDropoff = useVerifyDropoffOtp(booking.id, tripId);
  const getOrCreateConversation = useGetOrCreateConversationForBooking();

  const names = booking.passengers?.map((p) => p.fullName) ?? [];
  const passengerNames = names.join(', ') || `${booking.seatsCount} place(s)`;
  const firstName = names[0];
  const initials = firstName
    ? firstName
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase()
    : '';

  function handleRequest() {
    setFeedback(null);
    const mutation = phase === 'pickup' ? requestPickup : requestDropoff;
    mutation.mutate(undefined, {
      onSuccess: (result) => {
        setCodeVisible(true);
        // Le code est désormais toujours généré même si le SMS échoue
        // (canal best-effort) — le passager peut alors le consulter
        // directement dans son app plutôt que d'attendre un SMS qui
        // n'arrivera pas.
        if (!result.smsSent) {
          setFeedback({
            tone: 'info',
            title: 'Code généré',
            text: "Le SMS n'a pas pu être envoyé au passager — demandez-lui de consulter son code directement dans l'application (bouton « Voir mon code » sur sa réservation).",
          });
        }
      },
      onError: () => setFeedback({ tone: 'error', title: 'Erreur', text: 'La demande de code a échoué — réessayez.' }),
    });
  }

  function handleVerify() {
    setFeedback(null);
    const mutation = phase === 'pickup' ? verifyPickup : verifyDropoff;
    mutation.mutate(code, {
      onSuccess: () => {
        setCodeVisible(false);
        setCode('');
        setFeedback(null);
      },
      onError: (error) => {
        setFeedback({ tone: 'error', title: 'Code invalide', text: error instanceof ApiError ? error.message : 'Réessayez.' });
      },
    });
  }

  const isRequesting = phase === 'pickup' ? requestPickup.isPending : requestDropoff.isPending;
  const isVerifying = phase === 'pickup' ? verifyPickup.isPending : verifyDropoff.isPending;

  return (
    <OceanCard style={styles.bookingCard}>
      <View style={styles.bookingHeader}>
        <View style={styles.avatar}>
          {initials ? (
            <AppText variant="sm" weight="bold" color={OCEAN.base}>
              {initials}
            </AppText>
          ) : (
            <IconUsers size={18} color={OCEAN.base} />
          )}
        </View>
        <View style={styles.bookingText}>
          <AppText variant="base" weight="semibold" numberOfLines={1}>
            {passengerNames}
          </AppText>
          {isPartialBooking(booking) ? (
            <AppText variant="xs" weight="semibold" color={OCEAN.base} numberOfLines={1}>
              {bookingRoute(booking)?.from} → {bookingRoute(booking)?.to}
              {booking.boardingStop?.estimatedArrivalAt ? ` · prise en charge vers ${formatTime(booking.boardingStop.estimatedArrivalAt)}` : ''}
            </AppText>
          ) : null}
          <View style={styles.bookingMeta}>
            <AppText variant="xs" color="textSecondary">
              {booking.seatsCount} place{booking.seatsCount > 1 ? 's' : ''}
            </AppText>
            <OceanPill
              label={DRIVER_BOOKING_STATUS_LABELS[booking.status]}
              tone={booking.status === 'CONFIRMED' ? 'success' : 'neutral'}
            />
          </View>
        </View>
        <IconButton
          icon={<IconMessageCircle size={16} color={colors.textPrimary} />}
          accessibilityLabel="Contacter le passager"
          onPress={() =>
            getOrCreateConversation.mutate(booking.id, {
              onSuccess: (conversation) => router.push(`/(driver)/conversation/${conversation.id}`),
            })
          }
        />
      </View>

      {booking.customerPhone ? <ContactRow phone={booking.customerPhone} style={styles.contactRow} /> : null}

      {phase !== 'none' ? (
        <View style={styles.otpPanel}>
          <AppText variant="sm" weight="semibold">
            {phase === 'pickup' ? 'Valider la prise en charge' : 'Valider la dépose'}
          </AppText>
          {feedback ? <FeedbackBanner tone={feedback.tone} title={feedback.title} text={feedback.text} onDismiss={() => setFeedback(null)} /> : null}
          {phase === 'dropoff' && pickupMissed ? (
            <View style={styles.missedPickup}>
              <IconAlertTriangle size={15} color={colors.danger} />
              <AppText variant="xs" color="danger" style={styles.missedPickupText}>
                La prise en charge de ce passager n'a pas été validée. Vous pouvez quand même valider sa dépose avec son code :
                elle sera enregistrée sans prise en charge.
              </AppText>
            </View>
          ) : null}
          {!codeVisible ? (
            <>
              <AppText variant="xs" color="textSecondary">
                Le passager reçoit un code à 6 chiffres à vous communiquer.
              </AppText>
              <OceanButton
                label={phase === 'pickup' ? 'Demander le code de prise en charge' : 'Demander le code de dépose'}
                variant="soft"
                onPress={handleRequest}
                loading={isRequesting}
              />
            </>
          ) : (
            <>
              <AppText variant="xs" color="textSecondary">
                Code envoyé. Saisissez celui que le passager vous donne.
              </AppText>
              <View style={styles.codeRow}>
                <TextField
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="Code à 6 chiffres"
                  maxLength={6}
                  // `style` ne touche que le <TextInput> interne, jamais
                  // son conteneur — d'où le champ resté étroit malgré
                  // codeInput (flex: 1).
                  containerStyle={styles.codeInput}
                />
                <OceanButton label="Vérifier" onPress={handleVerify} loading={isVerifying} disabled={code.length !== 6} />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: '/(driver)/dispute-new',
                    params: {
                      subjectType: 'TRIP',
                      bookingId: booking.id,
                      reason:
                        phase === 'pickup'
                          ? 'Passager injoignable ou refuse de communiquer le code de prise en charge'
                          : 'Passager injoignable ou refuse de communiquer le code de dépose',
                      description: `Réservation de ${passengerNames}.`,
                    },
                  })
                }
                style={({ pressed }) => [styles.supportLink, pressed && styles.pressed]}
              >
                <IconLifebuoy size={14} color={OCEAN.base} />
                <AppText variant="xs" color={OCEAN.base} weight="semibold">
                  Passager injoignable ou refuse le code ? Contacter le support
                </AppText>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/(driver)/dispute-new',
            params: { subjectType: 'TRIP', bookingId: booking.id },
          })
        }
        style={({ pressed }) => [styles.reportLink, pressed && styles.pressed]}
      >
        <IconFlag size={13} color={colors.textMuted} />
        <AppText variant="xs" color="textMuted">
          Signaler un problème
        </AppText>
      </Pressable>
    </OceanCard>
  );
}

// ---------------------------------------------------------------------------
// Villes traversées
// ---------------------------------------------------------------------------

/**
 * Avant de signaler l'arrivée à l'étape suivante ou à destination : si un client n'a pas été pris en charge à son étape (code non
 * validé), le conducteur est prévenu. Une prise en charge oubliée ne se rattrape plus une fois l'étape dépassée ; il peut
 * quand même continuer (client absent), et la dépose de ce client restera possible.
 */
function usePickupMissedConfirm() {
  const [pending, setPending] = useState<{ title: string; message: string; proceed: () => void } | null>(null);

  function confirm(trip: Trip, bookings: Booking[], proceed: () => void): void {
    const missed = unpickedBoarders(trip, bookings);
    if (missed.length === 0) {
      proceed();
      return;
    }
    setPending({
      title: missed.length > 1 ? 'Prises en charge non validées' : 'Prise en charge non validée',
      message: `${missed.map((booking) => describeUnpicked(booking, trip)).join(' ; ')} ${
        missed.length > 1 ? "n'ont pas été pris en charge" : "n'a pas été pris en charge"
      } (code non validé). Validez d'abord la prise en charge si le passager est à bord. Vous pourrez quand même valider sa dépose plus tard.`,
      proceed,
    });
  }

  // À afficher une fois dans l'écran qui appelle confirm() : boîte de confirmation (Alert.alert ne fait rien sur le web).
  const dialog = (
    <ConfirmDialog
      visible={pending !== null}
      title={pending?.title ?? ''}
      message={pending?.message}
      confirmLabel="Continuer quand même"
      cancelLabel="Valider d'abord"
      destructive
      onConfirm={() => {
        const next = pending;
        setPending(null);
        next?.proceed();
      }}
      onCancel={() => setPending(null)}
    />
  );

  return { confirm, dialog };
}

/**
 * Étapes du trajet : heure de passage et prix de chaque tronçon. En brouillon, le conducteur ajuste les prix calculés
 * automatiquement, décoche une ville où il ne prend personne, retire ou ajoute une ville. En route, il signale son
 * arrivée à chaque étape pour prévenir les clients qui y montent.
 */
function TripStopsSection({
  trip,
  bookings,
  allowArrivalActions = true,
}: {
  trip: Trip;
  bookings: Booking[];
  /** false quand le guide pas à pas est affiché : l'arrivée à une ville se signale depuis le guide, jamais depuis la liste. */
  allowArrivalActions?: boolean;
}) {
  const isDraft = trip.status === 'DRAFT';
  const isRunning = trip.status === 'IN_PROGRESS';
  const stops = trip.stops ?? [];

  const addStop = useAddTripStop(trip.id);
  const updateStop = useUpdateTripStop(trip.id);
  const removeStop = useRemoveTripStop(trip.id);
  const markArrivedAtStop = useMarkArrivedAtStop(trip.id);
  // Mode automatique : les prix des étapes sont fixés par Occa'Z, le conducteur ne peut pas les modifier.
  const { data: priceGuidance } = useTripPriceGuidance(trip.originLocationId, trip.destinationLocationId);
  const farePriceLocked = priceGuidance?.mode === 'AUTO' && priceGuidance.applicable;

  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [fareText, setFareText] = useState('');
  const [addFieldKey, setAddFieldKey] = useState(0);
  // Le champ d'ajout (avec ses suggestions et adresses récentes) ne se déplie que sur demande.
  const [adding, setAdding] = useState(false);
  // Erreur / avertissement affiché dans la section, et ville dont le retrait attend confirmation (Alert.alert ne fait rien sur le web).
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [stopToRemove, setStopToRemove] = useState<TripStop | null>(null);
  const pickupMissed = usePickupMissedConfirm();

  // Rien à montrer sans étape, sauf en brouillon où le conducteur peut en ajouter.
  if (stops.length === 0 && !isDraft) return null;

  const total = Number(trip.pricePerSeat);
  const nextStopToReach = isRunning && allowArrivalActions ? stops.find((stop) => !stop.arrivedAt) : undefined;

  function showError(error: unknown) {
    setSectionError(error instanceof ApiError ? error.message : 'Réessayez.');
  }

  function startEditing(stop: TripStop) {
    setEditingStopId(stop.id);
    setFareText(stop.fareFromOrigin ? String(Number(stop.fareFromOrigin)) : '');
  }

  function saveFare(stop: TripStop) {
    const value = Number(fareText.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setSectionError('Prix invalide : indiquez un prix supérieur à zéro.');
      return;
    }
    setSectionError(null);
    updateStop.mutate(
      { stopId: stop.id, fareFromOrigin: String(Math.round(value)) },
      { onSuccess: () => setEditingStopId(null), onError: showError },
    );
  }

  function confirmRemove(stop: TripStop) {
    setSectionError(null);
    setStopToRemove(stop);
  }

  function handleAdd(location: TripLocation | null) {
    if (!location) return;
    setAddFieldKey((value) => value + 1);
    setSectionError(null);
    if (!location.cityId) {
      setSectionError('Ville manquante : choisissez une adresse située dans la ville traversée.');
      return;
    }
    if (
      location.cityId === trip.originCityId ||
      location.cityId === trip.destinationCityId ||
      stops.some((stop) => stop.cityId === location.cityId)
    ) {
      setSectionError('Ville déjà sur la route : cette ville est déjà le départ, l’arrivée ou une ville traversée.');
      return;
    }
    addStop.mutate(
      { locationId: location.id, sequence: insertionSequence(trip.originLocation, stops, location) },
      { onSuccess: () => setAdding(false), onError: showError },
    );
  }

  /** Clients qui montent / descendent à cette étape — le conducteur sait qui l'attend. */
  function peopleAt(stop: TripStop) {
    const boarding = bookings.filter((booking) => booking.boardingStopId === stop.id);
    const alighting = bookings.filter((booking) => booking.alightingStopId === stop.id);
    const count = (list: Booking[]) => list.reduce((sum, booking) => sum + booking.seatsCount, 0);
    return { boarding: count(boarding), alighting: count(alighting) };
  }

  return (
    <OceanSection icon={<IconMapPin size={17} color={OCEAN.base} />} title="Villes traversées">
      {sectionError ? <FeedbackBanner tone="error" text={sectionError} onDismiss={() => setSectionError(null)} /> : null}
      {isDraft ? (
        <AppText variant="xs" color="textSecondary">
          Les prix sont calculés automatiquement au prorata de la distance. Vous pouvez les modifier avant de publier ; ils
          ne changent plus ensuite.
        </AppText>
      ) : null}

      {!isDraft && trip.seatsByLeg && trip.seatsByLeg.length > 0 ? (
        <View style={styles.legSeats}>
          <AppText variant="xs" weight="semibold" color="textSecondary">
            Places libres par tronçon
          </AppText>
          <View style={styles.legSeatsChips}>
            {trip.seatsByLeg.map((leg) => (
              <OceanPill
                key={`${leg.fromStopId ?? 'origin'}-${leg.toStopId ?? 'destination'}`}
                label={`${leg.fromCityName ?? '…'} → ${leg.toCityName ?? '…'} : ${leg.freeSeats}/${trip.totalSeats}`}
                tone={leg.freeSeats === 0 ? 'neutral' : 'ocean'}
              />
            ))}
          </View>
          <AppText variant="xs" color="textMuted">
            Un client qui descend à une étape libère sa place pour les tronçons suivants.
          </AppText>
        </View>
      ) : null}

      <View style={styles.stopList}>
        {stops.map((stop, index) => {
          const fare = stop.fareFromOrigin != null ? Number(stop.fareFromOrigin) : null;
          const isEditing = editingStopId === stop.id;
          const people = peopleAt(stop);
          const reached = Boolean(stop.arrivedAt);
          return (
            <View key={stop.id} style={styles.stopCard}>
              <View style={styles.stopCardHeader}>
                <View style={[styles.stopCardBadge, reached && styles.stopCardBadgeDone]}>
                  <AppText variant="xs" weight="bold" color={reached ? colors.onPrimary : OCEAN.base}>
                    {index + 1}
                  </AppText>
                </View>
                <View style={styles.stopCardText}>
                  <AppText variant="base" weight="semibold" numberOfLines={1}>
                    {stopName(stop)}
                  </AppText>
                  <AppText variant="xs" color="textSecondary" numberOfLines={2}>
                    {stopAddress(stop)}
                  </AppText>
                  <AppText variant="xs" color="textSecondary">
                    {reached
                      ? `Passé à ${formatTime(stop.arrivedAt as string)}`
                      : stop.estimatedArrivalAt
                        ? `Passage estimé vers ${formatTime(stop.estimatedArrivalAt)}`
                        : 'Heure de passage non estimée'}
                  </AppText>
                </View>
                {isDraft ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Retirer ${stopName(stop)}`}
                    onPress={() => confirmRemove(stop)}
                    hitSlop={8}
                  >
                    <IconX size={18} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
              </View>

              {fare === null ? (
                <AppText variant="xs" color="danger">
                  Prix non défini : cette ville n'est pas réservable tant que vous n'avez pas indiqué un prix.
                </AppText>
              ) : (
                <View style={styles.stopFares}>
                  <AppText variant="xs" color="textSecondary">
                    {trip.originCity.name} → {stopName(stop)} : <AppText variant="xs" weight="bold">{formatMoney(fare, currencyOf(trip))}</AppText>
                  </AppText>
                  <AppText variant="xs" color="textSecondary">
                    {stopName(stop)} → {trip.destinationCity.name} :{' '}
                    <AppText variant="xs" weight="bold">{formatMoney(Math.max(0, total - fare), currencyOf(trip))}</AppText>
                  </AppText>
                </View>
              )}

              {people.boarding > 0 || people.alighting > 0 ? (
                <AppText variant="xs" weight="semibold" color={OCEAN.base}>
                  {[
                    people.boarding > 0 ? `${people.boarding} place${people.boarding > 1 ? 's' : ''} à prendre ici` : null,
                    people.alighting > 0 ? `${people.alighting} place${people.alighting > 1 ? 's' : ''} à déposer ici` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              ) : null}

              {isDraft ? (
                isEditing ? (
                  <View style={styles.stopEditRow}>
                    <TextField
                      value={fareText}
                      onChangeText={(text) => setFareText(text.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      placeholder={`Prix de ${trip.originCity.name} à ${stopName(stop)}`}
                      containerStyle={styles.codeInput}
                    />
                    <OceanButton label="Valider" onPress={() => saveFare(stop)} loading={updateStop.isPending} />
                  </View>
                ) : (
                  <View style={styles.stopActionsRow}>
                    {farePriceLocked ? (
                      <AppText variant="xs" color="textSecondary">
                        Prix fixé par Occa&apos;Z
                      </AppText>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => startEditing(stop)}
                        style={({ pressed }) => [styles.stopEditLink, pressed && styles.pressed]}
                      >
                        <IconPencil size={14} color={OCEAN.base} />
                        <AppText variant="xs" weight="semibold" color={OCEAN.base}>
                          Modifier le prix
                        </AppText>
                      </Pressable>
                    )}
                    <View style={styles.stopSwitch}>
                      <AppText variant="xs" color="textSecondary">
                        Je prends des passagers ici
                      </AppText>
                      <Switch
                        value={stop.isBookable !== false}
                        onValueChange={(value) => updateStop.mutate({ stopId: stop.id, isBookable: value }, { onError: showError })}
                      />
                    </View>
                  </View>
                )
              ) : null}

              {nextStopToReach?.id === stop.id ? (
                <OceanButton
                  label={`Je suis arrivé à ${stopName(stop)}`}
                  onPress={() =>
                    pickupMissed.confirm(trip, bookings, () => {
                      setSectionError(null);
                      markArrivedAtStop.mutate(stop.id, { onError: showError });
                    })
                  }
                  loading={markArrivedAtStop.isPending}
                />
              ) : null}
            </View>
          );
        })}
      </View>

      {isDraft ? (
        adding ? (
          <>
            <LocationAutocompleteField
              key={addFieldKey}
              label=""
              value={null}
              onChange={handleAdd}
              placeholder="Ajouter une ville traversée (ex. Mamou)"
            />
            <OceanButton label="Fermer" variant="soft" onPress={() => setAdding(false)} />
          </>
        ) : (
          <OceanButton label="Ajouter une ville traversée" variant="soft" onPress={() => setAdding(true)} />
        )
      ) : null}

      {pickupMissed.dialog}
      <ConfirmDialog
        visible={stopToRemove !== null}
        title={stopToRemove ? `Retirer ${stopName(stopToRemove)} ?` : ''}
        message="Les prix des autres villes ne changent pas."
        confirmLabel="Retirer"
        cancelLabel="Garder"
        destructive
        loading={removeStop.isPending}
        onConfirm={() => {
          const stop = stopToRemove;
          if (!stop) return;
          removeStop.mutate(stop.id, {
            onSuccess: () => setStopToRemove(null),
            onError: (error) => {
              setStopToRemove(null);
              showError(error);
            },
          });
        }}
        onCancel={() => setStopToRemove(null)}
      />
    </OceanSection>
  );
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function DriverTripDetailScreen() {
  const { id, created } = useLocalSearchParams<{ id: string; created?: string }>();
  const { data: trip, isLoading, isError } = useTrip(id);
  const { data: bookings } = useTripBookings(id);

  const publishTrip = usePublishTrip(id ?? '');
  const markDriverArrived = useMarkDriverArrived(id ?? '');
  const startTrip = useStartTrip(id ?? '');
  const markArrived = useMarkTripArrived(id ?? '');
  const completeTrip = useCompleteTrip(id ?? '');
  const cancelTrip = useCancelTrip(id ?? '');
  const { error: positionError, mode: positionMode } = useTripPositionBroadcast(id ?? '', trip?.status === 'IN_PROGRESS');
  // Parcours guidé : le détail complet est replié par défaut, à la demande du conducteur.
  const [showDetails, setShowDetails] = useState(false);
  // Annulation du trajet (boîte de confirmation) et erreur d'une action, affichées dans la page : Alert.alert ne fait rien sur le web.
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pickupMissed = usePickupMissedConfirm();

  if (isLoading || !trip) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
        {isError ? (
          <AppText variant="sm" color="danger">
            Impossible de charger ce trajet.
          </AppText>
        ) : (
          <ActivityIndicator color={OCEAN.base} />
        )}
      </ScreenContainer>
    );
  }

  const guided = isGuidedTrip(trip, bookings ?? []);
  // Brouillon ou publié sans réservation : l'essentiel (billet + action), le reste sous « Voir tous les détails ».
  const simple = !guided && (trip.status === 'DRAFT' || trip.status === 'PUBLISHED');
  const ticketVisible = !guided || showDetails;
  const secondaryVisible = guided || simple ? showDetails : true;
  const missingFare = (trip.stops ?? []).some((stop) => stop.fareFromOrigin == null);
  const activeBookings = (bookings ?? []).filter((b) => b.status === 'CONFIRMED');
  // Au moins une réservation payée (même règle que le serveur) : sinon personne à attendre au départ.
  const hasReservation = (bookings ?? []).some((b) => b.status === 'CONFIRMED' || b.status === 'PAID');

  // Clients qui montent au départ / à une étape — décide si le conducteur peut démarrer sans prise en charge au départ.
  const waitingAtOrigin = activeBookings.filter((booking) => !booking.boardingStopId && !booking.passengers?.some((p) => p.pickedUpAt));
  const waitingAtStops = activeBookings.filter((booking) => booking.boardingStopId);
  const onlyStopBookings = waitingAtOrigin.length === 0 && waitingAtStops.length > 0;

  function handleCancel() {
    setActionError(null);
    setCancelOpen(true);
  }

  function confirmCancel() {
    cancelTrip.mutate(
      { reason: "Annulé depuis l'application" },
      {
        onSuccess: () => setCancelOpen(false),
        onError: (error) => {
          setCancelOpen(false);
          setActionError(error instanceof ApiError ? error.message : "L'annulation a échoué — réessayez dans un instant.");
        },
      },
    );
  }

  /** Lance une action du trajet ; son échec s'affiche dans la page au lieu de passer inaperçu. */
  function attempt(start: (options: { onError: (error: unknown) => void }) => void) {
    setActionError(null);
    start({
      onError: (error) => setActionError(error instanceof ApiError ? error.message : "L'action a échoué — réessayez dans un instant."),
    });
  }

  // Une seule action possible à la fois, selon l'état du trajet.
  let action: StageAction | null = null;
  if (trip.status === 'DRAFT') {
    action = { label: 'Publier le trajet', run: () => attempt((options) => publishTrip.mutate(undefined, options)), isPending: publishTrip.isPending };
  } else if (trip.status === 'PUBLISHED' && hasReservation) {
    action = {
      label: 'Signaler mon arrivée au départ',
      run: () => attempt((options) => markDriverArrived.mutate(undefined, options)),
      isPending: markDriverArrived.isPending,
    };
  } else if (trip.status === 'PASSENGER_PICKED_UP' || (trip.status === 'DRIVER_ARRIVED' && onlyStopBookings)) {
    action = { label: 'Démarrer le trajet', run: () => attempt((options) => startTrip.mutate(undefined, options)), isPending: startTrip.isPending };
  } else if (trip.status === 'IN_PROGRESS') {
    action = {
      label: "Signaler l'arrivée à destination",
      run: () => pickupMissed.confirm(trip, activeBookings, () => attempt((options) => markArrived.mutate(undefined, options))),
      isPending: markArrived.isPending,
    };
  } else if (trip.status === 'ARRIVED' && activeBookings.length === 0) {
    action = { label: 'Clôturer le trajet', run: () => attempt((options) => completeTrip.mutate(undefined, options)), isPending: completeTrip.isPending };
  }

  const stage = getStage(trip.status, trip.status === 'PUBLISHED' ? hasReservation : activeBookings.length > 0, positionError, positionMode, onlyStopBookings);

  const originAddress =
    trip.originLocation?.label && trip.originLocation.label !== trip.originCity.name ? trip.originLocation.label : undefined;
  const destinationAddress =
    trip.destinationLocation?.label && trip.destinationLocation.label !== trip.destinationCity.name
      ? trip.destinationLocation.label
      : undefined;

  const seatsTitle = formatSeatsAvailability(trip.availableSeats);

  // Un brouillon n'est pas publié : rien ne peut y être réservé, la section « Passagers » n'a pas lieu d'être.
  const canReceiveBookings = ['PUBLISHED', 'BOOKING_PENDING', 'CONFIRMED'].includes(trip.status);
  const showPassengers = activeBookings.length > 0 || canReceiveBookings;

  const luggageLabel = trip.allowsLuggage ? 'Bagages acceptés' : 'Sans bagages';
  let shipmentsLabel = 'Sans envois';
  if (trip.allowsShipments) {
    if (trip.maxShipmentWeightKg != null && trip.availableShipmentWeightKg != null) {
      shipmentsLabel = `Envois · ${formatKg(trip.availableShipmentWeightKg)}/${formatKg(trip.maxShipmentWeightKg)} kg`;
    } else if (trip.maxShipmentWeightKg != null) {
      shipmentsLabel = `Envois · jusqu'à ${formatKg(trip.maxShipmentWeightKg)} kg`;
    } else {
      shipmentsLabel = 'Envois acceptés';
    }
  }

  const detailsToggle = (
    <OceanButton
      label={showDetails ? 'Masquer les détails du trajet' : 'Voir tous les détails du trajet'}
      variant="soft"
      icon={showDetails ? <IconChevronUp size={16} color={OCEAN.base} /> : <IconChevronDown size={16} color={OCEAN.base} />}
      onPress={() => setShowDetails((value) => !value)}
      style={styles.detailsToggle}
    />
  );

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader
        title="Détail du trajet"
        onBack={() => router.back()}
        // Affiché juste après la création du trajet : une croix qui revient à l'accueil, pas la flèche vers le formulaire.
        onClose={created ? () => closeToHome('/(driver)/(tabs)/home') : undefined}
      />

      {actionError ? <FeedbackBanner tone="error" text={actionError} onDismiss={() => setActionError(null)} /> : null}

      {guided ? (
        <>
          <DriverJourneyGuide
            trip={trip}
            bookings={bookings ?? []}
            positionNote={{ error: positionError, mode: positionMode }}
            onCancel={handleCancel}
            cancelPending={cancelTrip.isPending}
          />
          {detailsToggle}
        </>
      ) : null}

      {ticketVisible ? (
        <>
      {/* Billet : bandeau coloré + coupon détachable */}
      <View style={styles.ticketShadow}>
        <View style={styles.ticket}>
          <View style={[styles.hero, { backgroundColor: heroColorFor(trip.status) }]}>
            <View style={styles.decoLarge} />
            <View style={styles.decoSmall} />

            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <AppText variant="xs" weight="semibold" color={colors.onPrimary}>
                {TRIP_STATUS_LABELS[trip.status]}
              </AppText>
            </View>

            <View style={styles.when}>
              <AppText variant="sm" color={HERO_MUTED}>
                {capitalize(formatDateLong(trip.departureAt))}
              </AppText>
              <AppText variant="xxl" weight="bold" color={colors.onPrimary}>
                {formatTime(trip.departureAt)}
              </AppText>
            </View>

            <View style={styles.route}>
              <View style={styles.rail}>
                <View style={styles.railDotOrigin} />
                <View style={styles.railLine} />
                <View style={styles.railDotDestination} />
              </View>
              <View style={styles.stops}>
                <RouteStop eyebrow="Départ" city={trip.originCity.name} address={originAddress} />
                <RouteStop eyebrow="Arrivée" city={trip.destinationCity.name} address={destinationAddress} />
              </View>
            </View>
            {trip.stops && trip.stops.length > 0 ? (
              <AppText variant="xs" color={HERO_MUTED} numberOfLines={2}>
                Via {trip.stops.map((stop) => stopName(stop)).join(' · ')}
              </AppText>
            ) : null}
          </View>

          <View style={styles.tear}>
            <View style={[styles.notch, styles.notchLeft]} />
            <View style={styles.dashWrap}>
              <View style={styles.dash} />
            </View>
            <View style={[styles.notch, styles.notchRight]} />
          </View>

          <View style={styles.coupon}>
            <View style={styles.couponColumn}>
              <AppText variant="xs" color="textSecondary">
                Places
              </AppText>
              <AppText variant="md" weight="bold">
                {seatsTitle}
              </AppText>
              <SeatDots total={trip.totalSeats} available={trip.availableSeats} />
              <AppText variant="xs" color="textMuted">
                {trip.totalSeats} place{trip.totalSeats > 1 ? 's' : ''} au total
                {trip.stops && trip.stops.length > 0 ? ' · sur tout le trajet' : ''}
              </AppText>
            </View>
            <View style={styles.couponDivider} />
            <View style={[styles.couponColumn, styles.couponColumnRight]}>
              <AppText variant="xs" color="textSecondary">
                Prix par place
              </AppText>
              <AppText variant="md" weight="bold">
                {formatMoney(trip.pricePerSeat, currencyOf(trip))}
              </AppText>
            </View>
          </View>
        </View>
      </View>

        </>
      ) : null}

      {stage && !guided ? <StageCard stage={stage} action={action} /> : null}

      {simple && missingFare && !showDetails ? (
        <AppText variant="xs" color="danger" style={styles.missingFareNote}>
          Une ville traversée n&apos;a pas de prix : ouvrez les détails pour l&apos;indiquer avant de publier.
        </AppText>
      ) : null}

      {simple ? detailsToggle : null}

      {secondaryVisible ? (
        <>
      <TripStopsSection trip={trip} bookings={bookings ?? []} allowArrivalActions={!guided} />

      {trip.allowsShipments && ['PUBLISHED', 'DRIVER_ARRIVED'].includes(trip.status) ? (
        <OceanButton
          label="Colis sur ce trajet"
          variant="soft"
          onPress={() => router.push({ pathname: '/(driver)/shipment-available', params: { tripId: trip.id } })}
          style={styles.shipmentsButton}
        />
      ) : null}

      {showPassengers ? (
        <OceanSection
          icon={<IconUsers size={17} color={OCEAN.base} />}
          title="Passagers"
          action={
            activeBookings.length > 0 ? (
              <View style={styles.countPill}>
                <AppText variant="xs" weight="semibold" color={OCEAN.base}>
                  {activeBookings.length}
                </AppText>
              </View>
            ) : undefined
          }
        >
          {activeBookings.length > 0 ? (
            <View style={styles.bookingsList}>
              {activeBookings.map((booking) => (
                <BookingOtpCard
                  key={booking.id}
                  booking={booking}
                  tripId={trip.id}
                  phase={guided ? 'none' : getBookingPhase(booking, trip)}
                  pickupMissed={!guided && isPickupMissed(booking, trip)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyBookings}>
              <View style={styles.emptyIcon}>
                <IconUsers size={22} color={OCEAN.base} />
              </View>
              <AppText variant="sm" weight="semibold">
                Aucune réservation confirmée
              </AppText>
              <AppText variant="xs" color="textSecondary" style={styles.emptyText}>
                {trip.status === 'DRAFT'
                  ? 'Publiez le trajet pour recevoir des réservations.'
                  : 'Les passagers apparaîtront ici dès que leur réservation est confirmée.'}
              </AppText>
            </View>
          )}
        </OceanSection>
      ) : null}

      <OceanSection icon={<IconCar size={17} color={OCEAN.base} />} title="Détails">
        <View style={styles.detailCard}>
          {trip.vehicle.photoUrl ? (
            <Image source={{ uri: trip.vehicle.photoUrl }} style={styles.vehiclePhoto} />
          ) : (
            <View style={styles.vehicleIcon}>
              <IconCar size={22} color={OCEAN.base} />
            </View>
          )}
          <View style={styles.vehicleText}>
            <AppText variant="base" weight="semibold" numberOfLines={1}>
              {trip.vehicle.brand} {trip.vehicle.model}
            </AppText>
            <AppText variant="xs" color="textSecondary" numberOfLines={1}>
              {[trip.vehicle.color, `${trip.vehicle.totalSeats} places`].filter(Boolean).join(' · ')}
            </AppText>
          </View>
          <View style={styles.plate}>
            <AppText variant="xs" weight="bold">
              {trip.vehicle.plateNumber}
            </AppText>
          </View>
        </View>

        <View style={styles.chips}>
          <Chip icon={IconLuggage} label={luggageLabel} active={trip.allowsLuggage} />
          <Chip icon={IconPackage} label={shipmentsLabel} active={trip.allowsShipments} />
        </View>

        {trip.notes ? (
          <View style={styles.notes}>
            <IconNotes size={16} color={colors.textSecondary} />
            <AppText variant="sm" color="textSecondary" style={styles.notesText}>
              {trip.notes}
            </AppText>
          </View>
        ) : null}
      </OceanSection>

      {['DRAFT', 'PUBLISHED', 'DRIVER_ARRIVED'].includes(trip.status) ? (
        <OceanButton
          label="Annuler le trajet"
          variant="outline"
          onPress={handleCancel}
          loading={cancelTrip.isPending}
          style={styles.cancelButton}
        />
      ) : null}
        </>
      ) : null}

      {pickupMissed.dialog}
      <ConfirmDialog
        visible={cancelOpen}
        title="Annuler ce trajet ?"
        message="Toutes les réservations actives seront annulées."
        confirmLabel="Annuler le trajet"
        cancelLabel="Retour"
        destructive
        loading={cancelTrip.isPending}
        onConfirm={confirmCancel}
        onCancel={() => setCancelOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },

  // Billet
  ticketShadow: {
    borderRadius: 28,
    marginBottom: spacing.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  ticket: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg + spacing.xs,
    gap: spacing.md,
    overflow: 'hidden',
  },
  decoLarge: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decoSmall: {
    position: 'absolute',
    bottom: -40,
    left: -30,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: HERO_SOFT,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.onPrimary,
  },
  when: {
    gap: 2,
  },
  route: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
  },
  rail: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  railDotOrigin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.onPrimary,
  },
  railLine: {
    flex: 1,
    width: 2,
    minHeight: 24,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginVertical: 4,
  },
  railDotDestination: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.onPrimary,
  },
  stops: {
    flex: 1,
    justifyContent: 'space-between',
  },
  stop: {
    gap: 1,
  },
  tear: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  notch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background,
  },
  notchLeft: {
    marginLeft: -10,
  },
  notchRight: {
    marginRight: -10,
  },
  dashWrap: {
    flex: 1,
    paddingHorizontal: 4,
  },
  dash: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.border,
  },
  coupon: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  couponColumn: {
    flex: 1,
    gap: 2,
  },
  couponColumnRight: {
    alignItems: 'flex-end',
  },
  couponDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  seatDots: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 2,
  },
  seatDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: OCEAN.base,
  },
  seatDotTaken: {
    backgroundColor: OCEAN.base,
  },

  // Puces
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  chipActive: {
    backgroundColor: OCEAN.mist,
  },
  chipInactive: {
    backgroundColor: colors.surfaceMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },

  // Étape suivante
  stageCard: {
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stageIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageText: {
    flex: 1,
    gap: 2,
  },
  stageButton: {
    marginTop: spacing.xs,
  },

  // Passagers
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingsList: {
    gap: spacing.sm,
  },
  bookingCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactRow: {
    marginTop: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bookingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  otpPanel: {
    gap: spacing.xs,
    borderRadius: 16,
    backgroundColor: OCEAN.mist,
    padding: spacing.sm + 2,
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  codeInput: {
    flex: 1,
  },
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  emptyBookings: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    maxWidth: '85%',
  },

  // Détails
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  vehiclePhoto: {
    width: 48,
    height: 48,
    borderRadius: 14,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  plate: {
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  notes: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  notesText: {
    flex: 1,
  },

  cancelButton: {
    marginBottom: spacing.lg,
  },
  missingFareNote: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xxs,
  },
  detailsToggle: {
    marginBottom: spacing.md,
  },
  stopList: {
    gap: spacing.sm,
  },
  legSeats: {
    gap: spacing.xs,
  },
  legSeatsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  stopCard: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    shadowColor: '#0B3C5D',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stopCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stopCardBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
  },
  stopCardBadgeDone: {
    backgroundColor: OCEAN.base,
  },
  stopCardText: {
    flex: 1,
  },
  stopFares: {
    gap: 2,
  },
  stopEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stopActionsRow: {
    gap: spacing.sm,
  },
  stopEditLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  shipmentsButton: {
    marginBottom: spacing.md,
  },
  missedPickup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  missedPickupText: {
    flex: 1,
  },
});