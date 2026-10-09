// mobile/src/components/screens/DriverJourneyGuide.tsx
//
// [09/10/2026] v1 — Le guide du conducteur : l'écran ne montre QUE l'étape à faire, avec un seul bouton (ou un seul code à saisir).
// Tout le reste (billet, villes traversées, liste des passagers, véhicule) se consulte à la demande, sous « Voir tous les détails »,
// en lecture seule : une seule porte d'entrée pour avancer, donc jamais deux boutons qui prêtent à confusion.
//
// Quelle étape ? Voir utils/driverJourney.ts : elle se déduit de l'état du trajet et des réservations, jamais d'un état d'écran.
// [09/10/2026] v2 — Messages dans la page, plus d'Alert.alert : sur le web, Alert.alert ne fait RIEN (react-native-web ne l'implémente
// pas), si bien qu'une erreur (ex. « code invalide », ou un échec serveur) donnait l'impression que le bouton ne réagissait pas.
// Les erreurs et confirmations s'affichent désormais dans un bandeau en haut de l'étape ; « continuer sans ce client » passe par
// ConfirmDialog (qui marche partout). Identique sur web, Android et iOS.
//
// Les codes de prise en charge et de dépose sont envoyés automatiquement aux clients quand le conducteur signale son arrivée
// (serveur, TripArrivalService) : le conducteur n'a qu'à demander le code au client et à le saisir.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconCar,
  IconCash,
  IconChevronDown,
  IconChevronUp,
  IconCircleCheck,
  IconFlag,
  IconInfoCircle,
  IconLifebuoy,
  IconMapPin,
  IconMessageCircle,
  IconRefresh,
  IconRoute,
  IconUsers,
} from '@tabler/icons-react-native';
import { AppText, ConfirmDialog, IconButton, TextField } from '@/components/ui';
import { ContactRow } from '@/components/screens/ContactRow';
import { OceanButton, OceanCard, OceanPill } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import {
  useCompleteTrip,
  useMarkArrivedAtPickup,
  useMarkArrivedAtStop,
  useMarkDriverArrived,
  useMarkTripArrived,
  useStartTrip,
} from '@/hooks/useDriverTrips';
import {
  useRequestDropoffOtp,
  useRequestPickupOtp,
  useVerifyDropoffOtp,
  useVerifyPickupOtp,
} from '@/hooks/useBookings';
import { useGetOrCreateConversationForBooking } from '@/hooks/useConversations';
import { useSkippedBookings } from '@/hooks/useSkippedBookings';
import { ApiError } from '@/services/api/ApiError';
import { currencyOf, formatMoney } from '@/utils/money';
import { formatDateLong, formatTime } from '@/utils/date';
import { bookingRoute, isPartialBooking } from '@/utils/tripSegment';
import { isPickedUp } from '@/utils/bookingPhase';
import {
  computeJourney,
  earningLabelData,
  passengerLabel,
  tripEarnings,
  type JourneyPeople,
  type JourneyStep,
  type Waypoint,
} from '@/utils/driverJourney';
import type { Booking } from '@/types/bookings.types';
import type { Trip } from '@/types/trips.types';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

interface PositionNote {
  error?: string | null;
  mode?: string | null;
}

interface Props {
  trip: Trip;
  bookings: Booking[];
  positionNote: PositionNote;
  /** Annulation du trajet, proposée dans « Un problème ? » tant que personne n'est monté (publié ou conducteur arrivé). */
  onCancel: () => void;
  cancelPending: boolean;
}

interface ProblemItem {
  label: string;
  onPress: () => void;
  danger?: boolean;
}

interface PaidBanner {
  name: string;
  amountLabel: string | null;
}

/** Message à afficher dans le bandeau de l'étape (erreur ou confirmation). */
interface Feedback {
  tone: 'error' | 'info';
  title: string;
  text: string;
}

type Notify = (feedback: Feedback) => void;

function errorFeedback(error: unknown, title = 'Une erreur est survenue'): Feedback {
  return { tone: 'error', title, text: error instanceof ApiError ? error.message : 'Réessayez dans un instant.' };
}

/** Bandeau d'erreur / de confirmation, dans la page : visible partout (contrairement à Alert.alert sur le web). */
function FeedbackBanner({ feedback, onDismiss }: { feedback: Feedback; onDismiss: () => void }) {
  const isError = feedback.tone === 'error';
  return (
    <Pressable
      accessibilityRole="alert"
      onPress={onDismiss}
      style={[styles.feedback, isError ? styles.feedbackError : styles.feedbackInfo]}
    >
      {isError ? <IconAlertTriangle size={18} color={colors.danger} /> : <IconCircleCheck size={18} color={colors.successDark} />}
      <View style={styles.feedbackText}>
        <AppText variant="sm" weight="bold" color={isError ? 'danger' : colors.successDark}>
          {feedback.title}
        </AppText>
        <AppText variant="xs" color={isError ? 'danger' : colors.successDark}>
          {feedback.text}
        </AppText>
      </View>
    </Pressable>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one}`;
}

/** Ce qui attend le conducteur au point visé : « 1 place à prendre · 2 places à déposer ». */
function describePeople(people: JourneyPeople): string | null {
  const parts = [
    people.boarding > 0 ? `${plural(people.boarding, 'place à prendre', 'places à prendre')}` : null,
    people.alighting > 0 ? `${plural(people.alighting, 'place à déposer', 'places à déposer')}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// ---------------------------------------------------------------------------
// Briques visuelles
// ---------------------------------------------------------------------------

/** Barre de progression : un segment par point de la route (départ, villes avec des clients, destination). */
function JourneyProgress({ route, currentIndex, completed }: { route: Waypoint[]; currentIndex: number; completed: boolean }) {
  const current = route[currentIndex];
  return (
    <View style={styles.progress}>
      <View style={styles.progressBar}>
        {route.map((point, index) => {
          const isDone = completed || index < currentIndex;
          const isCurrent = !completed && index === currentIndex;
          return (
            <View
              key={`${point.kind}-${point.stopId ?? index}`}
              style={[styles.progressSegment, isDone && styles.progressDone, isCurrent && styles.progressCurrent]}
            />
          );
        })}
      </View>
      <AppText variant="xs" color="textSecondary" numberOfLines={1}>
        {completed
          ? 'Parcours terminé'
          : `Étape ${currentIndex + 1} sur ${route.length}${current ? ` · ${current.name}` : ''}`}
      </AppText>
    </View>
  );
}

/** En-tête de l'étape : grande icône, grand titre, une phrase. */
function StepHeader({
  icon: Icon,
  tone = 'ocean',
  title,
  text,
}: {
  icon: IconComponent;
  tone?: 'ocean' | 'success' | 'gold';
  title: string;
  text?: string;
}) {
  const palette =
    tone === 'success'
      ? { background: colors.successLight, foreground: colors.successDark }
      : tone === 'gold'
        ? { background: OCEAN.goldSoft, foreground: OCEAN.goldInk }
        : { background: OCEAN.mist, foreground: OCEAN.base };
  return (
    <View style={styles.stepHeader}>
      <View style={[styles.stepIcon, { backgroundColor: palette.background }]}>
        <Icon size={32} color={palette.foreground} />
      </View>
      <AppText variant="xxl" weight="bold" color={OCEAN.deep} align="center">
        {title}
      </AppText>
      {text ? (
        <AppText variant="md" color="textSecondary" align="center">
          {text}
        </AppText>
      ) : null}
    </View>
  );
}

/** « Un problème ? » — replié par défaut : les cas rares ne polluent pas l'étape à faire. */
function ProblemSection({ items }: { items: ProblemItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <View style={styles.problem}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [styles.problemToggle, pressed && styles.pressed]}
      >
        <IconLifebuoy size={15} color={colors.textSecondary} />
        <AppText variant="sm" weight="medium" color="textSecondary">
          Un problème ?
        </AppText>
        {open ? <IconChevronUp size={15} color={colors.textSecondary} /> : <IconChevronDown size={15} color={colors.textSecondary} />}
      </Pressable>
      {open
        ? items.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              onPress={item.onPress}
              style={({ pressed }) => [styles.problemItem, pressed && styles.pressed]}
            >
              <AppText variant="sm" weight="semibold" color={item.danger ? colors.danger : OCEAN.base}>
                {item.label}
              </AppText>
            </Pressable>
          ))
        : null}
    </View>
  );
}

/** Le client dont c'est le tour : nom, places, tronçon, et de quoi le joindre. */
function PassengerCard({ booking, tripId }: { booking: Booking; tripId: string }) {
  const getOrCreateConversation = useGetOrCreateConversationForBooking();
  const label = passengerLabel(booking);
  const first = booking.passengers?.[0]?.fullName;
  const initials = first
    ? first
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase()
    : '';
  const route = isPartialBooking(booking) ? bookingRoute(booking) : null;

  return (
    <View style={styles.passenger} testID={`passenger-${tripId}-${booking.id}`}>
      <View style={styles.passengerRow}>
        <View style={styles.avatar}>
          {initials ? (
            <AppText variant="md" weight="bold" color={OCEAN.base}>
              {initials}
            </AppText>
          ) : (
            <IconUsers size={20} color={OCEAN.base} />
          )}
        </View>
        <View style={styles.passengerText}>
          <AppText variant="md" weight="semibold" numberOfLines={2}>
            {label}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            {plural(booking.seatsCount, 'place', 'places')}
            {route ? ` · ${route.from} → ${route.to}` : ''}
          </AppText>
        </View>
        <IconButton
          icon={<IconMessageCircle size={16} color={colors.textPrimary} />}
          accessibilityLabel="Écrire au passager"
          onPress={() =>
            getOrCreateConversation.mutate(booking.id, {
              onSuccess: (conversation) => router.push(`/(driver)/conversation/${conversation.id}`),
            })
          }
        />
      </View>
      {booking.customerPhone ? <ContactRow phone={booking.customerPhone} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Étapes
// ---------------------------------------------------------------------------

/** « En route vers … » : un seul bouton, « Je suis arrivé ». */
function GoToStep({
  waypoint,
  people,
  isFirst,
  positionNote,
  onArrived,
  pending,
  problems,
}: {
  waypoint: Waypoint;
  people: JourneyPeople;
  isFirst: boolean;
  positionNote: PositionNote;
  onArrived: () => void;
  pending: boolean;
  problems: ProblemItem[];
}) {
  const waiting = describePeople(people);
  const where = waypoint.address ?? waypoint.name;
  const title = isFirst ? 'Allez chercher votre client' : `En route vers ${waypoint.name}`;
  const text = isFirst ? `Rendez-vous au point de départ : ${where}.` : `Direction : ${where}.`;
  const hint =
    waypoint.kind === 'DESTINATION'
      ? 'À votre arrivée, chaque passager à bord reçoit automatiquement son code de dépose.'
      : 'À votre arrivée, vos clients sont prévenus et reçoivent automatiquement leur code.';

  return (
    <OceanCard style={styles.stepCard}>
      <StepHeader icon={isFirst ? IconMapPin : IconRoute} title={title} text={text} />
      {waiting ? (
        <View style={styles.centered}>
          <OceanPill label={waiting} tone="ocean" />
        </View>
      ) : null}
      {positionNote.error ? (
        <View style={styles.notice}>
          <IconInfoCircle size={16} color={OCEAN.goldInk} />
          <AppText variant="xs" color={OCEAN.goldInk} style={styles.noticeText}>
            {positionNote.error}
          </AppText>
        </View>
      ) : !isFirst ? (
        <AppText variant="xs" color="textMuted" align="center">
          {positionNote.mode === 'background'
            ? 'Votre position est partagée avec vos passagers, même en arrière-plan.'
            : 'Votre position est partagée avec vos passagers tant que l’application reste ouverte.'}
        </AppText>
      ) : null}
      <OceanButton
        label={isFirst ? 'Je suis arrivé au départ' : `Je suis arrivé à ${waypoint.name}`}
        onPress={onArrived}
        loading={pending}
        style={styles.mainButton}
      />
      <AppText variant="xs" color="textMuted" align="center">
        {hint}
      </AppText>
      <ProblemSection items={problems} />
    </OceanCard>
  );
}

/**
 * Les déposes de la ville sont faites : « En route pour chercher X », puis « Je suis arrivé sur les lieux ». C'est ce bouton qui
 * prévient le client et lui envoie son code de prise en charge.
 */
function GoToPickupStep({
  waypoint,
  bookings,
  positionNote,
  onArrived,
  pending,
}: {
  waypoint: Waypoint;
  bookings: Booking[];
  positionNote: PositionNote;
  onArrived: () => void;
  pending: boolean;
}) {
  const names = bookings.map((booking) => passengerLabel(booking)).join(' et ');
  const where = waypoint.address ?? waypoint.name;
  return (
    <OceanCard style={styles.stepCard}>
      <StepHeader icon={IconMapPin} title={`En route pour chercher ${names}`} text={`Rendez-vous à ${where}.`} />
      {bookings.map((booking) => (
        <PassengerCard key={booking.id} booking={booking} tripId={booking.tripId} />
      ))}
      {positionNote.error ? (
        <View style={styles.notice}>
          <IconInfoCircle size={16} color={OCEAN.goldInk} />
          <AppText variant="xs" color={OCEAN.goldInk} style={styles.noticeText}>
            {positionNote.error}
          </AppText>
        </View>
      ) : null}
      <OceanButton label="Je suis arrivé sur les lieux" onPress={onArrived} loading={pending} style={styles.mainButton} />
      <AppText variant="xs" color="textMuted" align="center">
        {bookings.length > 1
          ? 'À votre arrivée, vos clients sont prévenus et reçoivent automatiquement leur code de prise en charge.'
          : 'À votre arrivée, votre client est prévenu et reçoit automatiquement son code de prise en charge.'}
      </AppText>
    </OceanCard>
  );
}

/** Prise en charge ou dépose d'UN client : il donne son code, le conducteur le saisit. */
function CodeStep({
  trip,
  step,
  onDropoffValidated,
  onSkip,
  notify,
}: {
  trip: Trip;
  step: Extract<JourneyStep, { kind: 'pickup' | 'dropoff' }>;
  onDropoffValidated: (booking: Booking) => void;
  onSkip: (booking: Booking) => void;
  notify: Notify;
}) {
  const { booking } = step;
  const isPickup = step.kind === 'pickup';
  const requestPickup = useRequestPickupOtp(booking.id, trip.id);
  const verifyPickup = useVerifyPickupOtp(booking.id, trip.id);
  const requestDropoff = useRequestDropoffOtp(booking.id, trip.id);
  const verifyDropoff = useVerifyDropoffOtp(booking.id, trip.id);

  // Les codes partent tout seuls à l'arrivée du conducteur : prise en charge pour tous, dépose pour les clients à bord. Seul un
  // client dont la prise en charge a été oubliée n'a pas reçu de code de dépose : on le lui envoie à la demande.
  const [codeSent, setCodeSent] = useState(isPickup || isPickedUp(booking));
  const [code, setCode] = useState('');
  const [confirmSkipOpen, setConfirmSkipOpen] = useState(false);

  const request = isPickup ? requestPickup : requestDropoff;
  const verify = isPickup ? verifyPickup : verifyDropoff;
  const label = passengerLabel(booking);

  function sendCode(onDone?: () => void) {
    request.mutate(undefined, {
      onSuccess: (result) => {
        setCodeSent(true);
        if (!result.smsSent) {
          notify({
            tone: 'info',
            title: 'Code généré',
            text: "Le SMS n'a pas pu être envoyé au passager — demandez-lui d'ouvrir son code dans l'application (bouton « Voir mon code » sur sa réservation).",
          });
        } else {
          onDone?.();
        }
      },
      onError: () => notify({ tone: 'error', title: 'Erreur', text: 'La demande de code a échoué — réessayez.' }),
    });
  }

  function validate() {
    verify.mutate(code, {
      onSuccess: () => {
        setCode('');
        if (!isPickup) onDropoffValidated(booking);
      },
      onError: (error) => notify(errorFeedback(error, 'Code invalide')),
    });
  }

  function confirmSkip() {
    setConfirmSkipOpen(true);
  }

  const problems: ProblemItem[] = [
    {
      label: isPickup ? 'Ce client ne vient pas — continuer sans lui' : "Ce passager n'est pas à bord — passer",
      onPress: confirmSkip,
      danger: true,
    },
    {
      label: 'Contacter le support',
      onPress: () =>
        router.push({
          pathname: '/(driver)/dispute-new',
          params: {
            subjectType: 'TRIP',
            bookingId: booking.id,
            reason: isPickup
              ? 'Passager injoignable ou refuse de communiquer le code de prise en charge'
              : 'Passager injoignable ou refuse de communiquer le code de dépose',
            description: `Réservation de ${label}.`,
          },
        }),
    },
  ];

  const counter = step.total > 1 ? `Client ${Math.min(step.position, step.total)} sur ${step.total} · ` : '';
  const title = isPickup ? 'Prise en charge' : 'Dépose';
  const text = isPickup
    ? `${counter}Demandez son code de prise en charge à ${label}.`
    : `${counter}${step.waypoint.name} : demandez son code de dépose à ${label}.`;

  return (
    <OceanCard style={styles.stepCard}>
      <StepHeader icon={isPickup ? IconUsers : IconFlag} title={title} text={text} />
      <PassengerCard booking={booking} tripId={trip.id} />

      {step.kind === 'dropoff' && step.pickupMissed ? (
        <View style={styles.notice}>
          <IconAlertTriangle size={16} color={colors.danger} />
          <AppText variant="xs" color="danger" style={styles.noticeText}>
            La prise en charge de ce passager n&apos;a pas été validée. Vous pouvez quand même valider sa dépose : elle sera
            enregistrée sans prise en charge.
          </AppText>
        </View>
      ) : null}

      {codeSent ? (
        <>
          <AppText variant="sm" color="textSecondary" align="center">
            Le passager a reçu son code par SMS et peut aussi l&apos;afficher dans son application (« Voir mon code »).
          </AppText>
          <View style={styles.codeRow}>
            <TextField
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="Code à 6 chiffres"
              maxLength={6}
              containerStyle={styles.codeInput}
            />
          </View>
          <OceanButton
            label={isPickup ? 'Valider la prise en charge' : 'Valider la dépose'}
            onPress={validate}
            loading={verify.isPending}
            disabled={code.length !== 6}
            style={styles.mainButton}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => sendCode(() => notify({ tone: 'info', title: 'Code renvoyé', text: 'Un nouveau code vient d’être envoyé au passager.' }))}
            disabled={request.isPending}
            style={({ pressed }) => [styles.resend, pressed && styles.pressed]}
          >
            <IconRefresh size={14} color={OCEAN.base} />
            <AppText variant="sm" weight="semibold" color={OCEAN.base}>
              Le passager n&apos;a pas reçu le code ? Renvoyer
            </AppText>
          </Pressable>
        </>
      ) : (
        <>
          <AppText variant="sm" color="textSecondary" align="center">
            Ce passager n&apos;a pas encore reçu de code de dépose : envoyez-le lui, puis saisissez celui qu&apos;il vous donne.
          </AppText>
          <OceanButton label="Envoyer le code au passager" onPress={() => sendCode()} loading={request.isPending} style={styles.mainButton} />
        </>
      )}
      <ProblemSection items={problems} />

      <ConfirmDialog
        visible={confirmSkipOpen}
        title={isPickup ? `Continuer sans ${label} ?` : `${label} n'est pas à bord ?`}
        message="Sa réservation restera ouverte : vous devrez la régler avec le support avant de pouvoir clôturer le trajet."
        confirmLabel="Continuer sans lui"
        destructive
        onConfirm={() => {
          setConfirmSkipOpen(false);
          onSkip(booking);
        }}
        onCancel={() => setConfirmSkipOpen(false)}
      />
    </OceanCard>
  );
}

function StartStep({
  next,
  positionNote,
  onStart,
  pending,
  problems,
}: {
  next: Waypoint;
  positionNote: PositionNote;
  onStart: () => void;
  pending: boolean;
  problems: ProblemItem[];
}) {
  return (
    <OceanCard style={styles.stepCard}>
      <StepHeader
        icon={IconCar}
        tone="success"
        title="Tout le monde est à bord"
        text={`Vous pouvez partir. Prochaine étape : ${next.name}.`}
      />
      {positionNote.error ? (
        <View style={styles.notice}>
          <IconInfoCircle size={16} color={OCEAN.goldInk} />
          <AppText variant="xs" color={OCEAN.goldInk} style={styles.noticeText}>
            {positionNote.error}
          </AppText>
        </View>
      ) : null}
      <OceanButton label="Démarrer le trajet" onPress={onStart} loading={pending} style={styles.mainButton} />
      <AppText variant="xs" color="textMuted" align="center">
        Votre position sera partagée avec vos passagers pendant le trajet.
      </AppText>
      <ProblemSection items={problems} />
    </OceanCard>
  );
}

function CloseStep({ onClose, pending }: { onClose: () => void; pending: boolean }) {
  return (
    <OceanCard style={styles.stepCard}>
      <StepHeader
        icon={IconFlag}
        tone="success"
        title="Vous êtes arrivé"
        text="Tous vos passagers sont déposés. Il ne reste qu’à clôturer le trajet."
      />
      <OceanButton label="Clôturer le trajet" onPress={onClose} loading={pending} style={styles.mainButton} />
    </OceanCard>
  );
}

function BlockedStep({ bookings, onRetry }: { bookings: Booking[]; onRetry: () => void }) {
  const first = bookings[0];
  return (
    <OceanCard style={styles.stepCard}>
      <StepHeader
        icon={IconAlertTriangle}
        tone="gold"
        title="Une réservation reste ouverte"
        text={`${bookings.map((booking) => passengerLabel(booking)).join(', ')} : vous avez continué sans ce client. Le trajet ne peut pas être clôturé avant que le support règle sa réservation.`}
      />
      <OceanButton
        label="Contacter le support"
        onPress={() =>
          router.push({
            pathname: '/(driver)/dispute-new',
            params: {
              subjectType: 'TRIP',
              bookingId: first.id,
              reason: 'Client absent ou injoignable — réservation à régler avant la clôture du trajet',
              description: `Réservation de ${passengerLabel(first)}.`,
            },
          })
        }
        style={styles.mainButton}
      />
      <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.resend, pressed && styles.pressed]}>
        <AppText variant="sm" weight="semibold" color={OCEAN.base}>
          Finalement, je valide son code
        </AppText>
      </Pressable>
    </OceanCard>
  );
}

function CompletedStep({ trip, bookings }: { trip: Trip; bookings: Booking[] }) {
  const earned = tripEarnings(trip, bookings);
  return (
    <OceanCard style={styles.stepCard}>
      <StepHeader
        icon={IconCircleCheck}
        tone="success"
        title="Trajet terminé"
        text={
          earned
            ? `Merci ! ${formatMoney(earned.amount, earned.currency)} ont été ajoutés à votre solde pendant ce trajet.`
            : 'Merci ! Ce trajet est clôturé.'
        }
      />
      <OceanButton
        label="Voir mon portefeuille"
        variant="soft"
        onPress={() => router.push('/(driver)/(tabs)/wallet')}
        style={styles.mainButton}
      />
    </OceanCard>
  );
}

/** Confirmation de l'argent reçu dès qu'une dépose est validée — sans attendre la fin du trajet. */
function PaidBannerView({ paid }: { paid: PaidBanner }) {
  return (
    <View style={styles.paid}>
      <IconCash size={20} color={colors.successDark} />
      <View style={styles.paidText}>
        <AppText variant="sm" weight="bold" color={colors.successDark}>
          Dépose validée
        </AppText>
        <AppText variant="xs" color={colors.successDark}>
          {paid.amountLabel
            ? `${paid.amountLabel} ajoutés à votre solde pour ${paid.name}.`
            : `Votre paiement pour ${paid.name} a été ajouté à votre solde.`}
        </AppText>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Guide
// ---------------------------------------------------------------------------

/** Rappel compact du trajet — remplace le grand billet, qui reste accessible sous « Voir tous les détails ». */
function TripSummaryBar({ trip }: { trip: Trip }) {
  const via = (trip.stops ?? []).length > 0 ? ` · via ${(trip.stops ?? []).map((stop) => stop.city?.name ?? stop.location?.label ?? 'étape').join(', ')}` : '';
  return (
    <View style={styles.summary}>
      <AppText variant="md" weight="bold" color={OCEAN.deep} numberOfLines={1}>
        {trip.originCity.name} → {trip.destinationCity.name}
      </AppText>
      <AppText variant="xs" color="textSecondary" numberOfLines={2}>
        {formatDateLong(trip.departureAt)} · {formatTime(trip.departureAt)}
        {via}
      </AppText>
    </View>
  );
}

export function DriverJourneyGuide({ trip, bookings, positionNote, onCancel, cancelPending }: Props) {
  const { skipped, skip, unskipAll } = useSkippedBookings(trip.id);
  const journey = computeJourney(trip, bookings, skipped);
  const { step } = journey;

  const markDriverArrived = useMarkDriverArrived(trip.id);
  const startTrip = useStartTrip(trip.id);
  const markArrivedAtStop = useMarkArrivedAtStop(trip.id);
  const markArrivedAtPickup = useMarkArrivedAtPickup(trip.id);
  const markArrived = useMarkTripArrived(trip.id);
  const completeTrip = useCompleteTrip(trip.id);

  const [paid, setPaid] = useState<PaidBanner | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const reportError = (error: unknown) => setFeedback(errorFeedback(error));

  // Le message appartient à l'étape où il est apparu : il disparaît quand on change d'étape, ou au bout de quelques secondes.
  const stepKey = `${step.kind}-${'booking' in step ? step.booking.id : 'waypoint' in step ? (step.waypoint.stopId ?? step.waypoint.kind) : ''}`;
  useEffect(() => {
    setFeedback(null);
  }, [stepKey]);
  useEffect(() => {
    if (!feedback) return undefined;
    const timer = setTimeout(() => setFeedback(null), 12_000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // La confirmation de paiement reste affichée un moment, puis s'efface d'elle-même.
  useEffect(() => {
    if (!paid) return undefined;
    const timer = setTimeout(() => setPaid(null), 15_000);
    return () => clearTimeout(timer);
  }, [paid]);

  function handleDropoffValidated(booking: Booking) {
    const data = earningLabelData(trip, booking);
    setPaid({ name: passengerLabel(booking), amountLabel: data ? formatMoney(data.amount, data.currency ?? currencyOf(trip)) : null });
  }

  function cancelProblem(): ProblemItem[] {
    if (trip.status !== 'PUBLISHED' && trip.status !== 'DRIVER_ARRIVED') return [];
    return [{ label: 'Annuler le trajet', onPress: onCancel, danger: true }];
  }

  const cancelNote = cancelPending ? [] : cancelProblem();

  let content: React.ReactNode = null;
  switch (step.kind) {
    case 'go_to': {
      const { waypoint } = step;
      const onArrived =
        waypoint.kind === 'ORIGIN'
          ? () => markDriverArrived.mutate(undefined, { onError: reportError })
          : waypoint.kind === 'DESTINATION'
            ? () => markArrived.mutate(undefined, { onError: reportError })
            : () => markArrivedAtStop.mutate(waypoint.stopId as string, { onError: reportError });
      const pending =
        waypoint.kind === 'ORIGIN'
          ? markDriverArrived.isPending
          : waypoint.kind === 'DESTINATION'
            ? markArrived.isPending
            : markArrivedAtStop.isPending;
      content = (
        <GoToStep
          waypoint={waypoint}
          people={step.people}
          isFirst={waypoint.kind === 'ORIGIN'}
          positionNote={positionNote}
          onArrived={onArrived}
          pending={pending}
          problems={waypoint.kind === 'ORIGIN' ? cancelNote : []}
        />
      );
      break;
    }
    case 'go_to_pickup':
      content = (
        <GoToPickupStep
          waypoint={step.waypoint}
          bookings={step.bookings}
          positionNote={positionNote}
          onArrived={() => markArrivedAtPickup.mutate(step.waypoint.stopId as string, { onError: reportError })}
          pending={markArrivedAtPickup.isPending}
        />
      );
      break;
    case 'pickup':
    case 'dropoff':
      content = (
        <CodeStep
          key={`${step.kind}-${step.booking.id}`}
          trip={trip}
          step={step}
          onDropoffValidated={handleDropoffValidated}
          onSkip={(booking) => skip(booking.id)}
          notify={setFeedback}
        />
      );
      break;
    case 'start':
      content = (
        <StartStep
          next={step.next}
          positionNote={positionNote}
          onStart={() => startTrip.mutate(undefined, { onError: reportError })}
          pending={startTrip.isPending}
          problems={trip.status === 'DRIVER_ARRIVED' ? cancelNote : []}
        />
      );
      break;
    case 'close':
      content = <CloseStep onClose={() => completeTrip.mutate(undefined, { onError: reportError })} pending={completeTrip.isPending} />;
      break;
    case 'blocked':
      content = <BlockedStep bookings={step.bookings} onRetry={unskipAll} />;
      break;
    case 'completed':
      content = <CompletedStep trip={trip} bookings={bookings} />;
      break;
    default:
      content = null;
  }

  return (
    <View style={styles.guide}>
      <TripSummaryBar trip={trip} />
      <JourneyProgress route={journey.route} currentIndex={journey.currentIndex} completed={step.kind === 'completed'} />
      {paid ? <PaidBannerView paid={paid} /> : null}
      {feedback ? <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} /> : null}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  guide: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  centered: {
    alignItems: 'center',
  },

  summary: {
    gap: 2,
    paddingHorizontal: spacing.xxs,
  },
  progress: {
    gap: 6,
    paddingHorizontal: spacing.xxs,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: OCEAN.line,
  },
  progressDone: {
    backgroundColor: OCEAN.base,
  },
  progressCurrent: {
    backgroundColor: OCEAN.bright,
  },

  stepCard: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  stepHeader: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  mainButton: {
    minHeight: 56,
  },

  passenger: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: OCEAN.mist,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passengerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },

  codeRow: {
    flexDirection: 'row',
  },
  codeInput: {
    flex: 1,
  },
  resend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xxs,
  },

  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  feedbackError: {
    backgroundColor: '#FDE8E8',
    borderColor: '#F5C2C2',
  },
  feedbackInfo: {
    backgroundColor: colors.successLight,
    borderColor: '#B7E4D3',
  },
  feedbackText: {
    flex: 1,
    gap: 2,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  noticeText: {
    flex: 1,
  },

  problem: {
    gap: spacing.xs,
    alignItems: 'center',
  },
  problemToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xxs,
  },
  problemItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },

  paid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.successLight,
  },
  paidText: {
    flex: 1,
    gap: 1,
  },
});