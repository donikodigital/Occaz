// mobile/src/utils/driverJourney.ts
//
// [09/10/2026] v1 — Le parcours du conducteur, une étape à la fois.
//
// Une fois un trajet publié et payé par un client, le conducteur est guidé : l'écran ne montre QUE l'étape à faire, avec un seul
// bouton (ou un seul code à saisir). Cette fonction décide laquelle, à partir de l'état du trajet et des réservations — jamais d'un
// état « d'écran » à part : si le conducteur ferme l'application et la rouvre, il retrouve la même étape.
//
// Le parcours, pour chaque point de la route (départ → villes où des clients montent ou descendent → destination) :
//   1. « En route » vers le point  →  bouton « Je suis arrivé à … » (les clients concernés sont prévenus et reçoivent leur code)
//   2. Dépose, un client après l'autre : il donne son code de dépose, le conducteur le saisit (l'argent de ce client est alors
//      versé sur son solde, sans attendre la fin du trajet)
//   3. Prise en charge à une ville traversée où des clients descendent ET d'autres montent : après les déposes, « En route pour
//      chercher X » → « Je suis arrivé sur les lieux » (le client est alors prévenu et reçoit son code), puis son code, un client
//      après l'autre. Si personne ne descend dans la ville, « Je suis arrivé à … » suffit : on passe directement aux codes.
//      Prise en charge : le client donne son code de prise en charge, le conducteur le saisit.
//   4. Au départ, une fois tout le monde à bord : « Démarrer le trajet » ; puis on repart à l'étape 1 vers le point suivant
//   5. À la destination : dépose de chaque client à bord, puis « Clôturer le trajet ».
// Une ville où personne ne monte ni ne descend n'est jamais demandée (le serveur non plus).
//
// Client absent : le conducteur peut continuer sans lui (`skipped`, conservé sur le téléphone). Sa réservation reste ouverte et
// bloque la clôture tant qu'elle n'est pas réglée avec le support — voir l'étape « blocked ».
import type { Booking } from '@/types/bookings.types';
import type { Trip, TripStop } from '@/types/trips.types';
import { isPickedUp } from '@/utils/bookingPhase';
import { currencyOf } from '@/utils/money';
import { stopAddress, stopName } from '@/utils/tripSegment';

export interface Waypoint {
  /** null pour le départ et la destination du trajet. */
  stopId: string | null;
  kind: 'ORIGIN' | 'STOP' | 'DESTINATION';
  name: string;
  address?: string;
}

/** Places à prendre / à déposer à un point de la route. */
export interface JourneyPeople {
  boarding: number;
  alighting: number;
}

export type JourneyStep =
  /** En route vers un point : un seul bouton, « Je suis arrivé à … ». */
  | { kind: 'go_to'; waypoint: Waypoint; people: JourneyPeople }
  /** Après les déposes d'une ville : en route vers les clients qui montent ici, un seul bouton « Je suis arrivé sur les lieux ». */
  | { kind: 'go_to_pickup'; waypoint: Waypoint; bookings: Booking[] }
  /** Prise en charge d'UN client : il donne son code, le conducteur le saisit. */
  | { kind: 'pickup'; waypoint: Waypoint; booking: Booking; position: number; total: number }
  /** Dépose d'UN client : même principe. `pickupMissed` : sa prise en charge n'a jamais été validée. */
  | { kind: 'dropoff'; waypoint: Waypoint; booking: Booking; position: number; total: number; pickupMissed: boolean }
  /** Tout le monde est à bord (ou absent, écarté) : « Démarrer le trajet ». */
  | { kind: 'start'; next: Waypoint }
  /** Arrivé, tout le monde est déposé : « Clôturer le trajet ». */
  | { kind: 'close' }
  /** Arrivé, mais des clients écartés (absents) ont encore une réservation ouverte : à régler avec le support. */
  | { kind: 'blocked'; bookings: Booking[] }
  | { kind: 'completed' }
  /** Statut hors parcours guidé (brouillon, annulé, litige…) : l'écran complet s'affiche. */
  | { kind: 'unavailable' };

export interface Journey {
  step: JourneyStep;
  /** Les arrêts du parcours, dans l'ordre : départ, villes avec des clients, destination. */
  route: Waypoint[];
  /** Position, dans `route`, du point où en est le conducteur. */
  currentIndex: number;
}

/** Statuts de réservation qui comptent des gens sur la route (terminée comprise : sa ville reste dans le parcours). */
const ON_ROUTE_STATUSES: ReadonlySet<string> = new Set(['PAID', 'CONFIRMED', 'COMPLETED']);

function seatsOf(bookings: Booking[]): number {
  return bookings.reduce((sum, booking) => sum + booking.seatsCount, 0);
}

function sortedStops(trip: Trip): TripStop[] {
  return [...(trip.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
}

export function originWaypoint(trip: Trip): Waypoint {
  const label = trip.originLocation?.label;
  return {
    stopId: null,
    kind: 'ORIGIN',
    name: trip.originCity.name,
    address: label && label !== trip.originCity.name ? label : undefined,
  };
}

export function destinationWaypoint(trip: Trip): Waypoint {
  const label = trip.destinationLocation?.label;
  return {
    stopId: null,
    kind: 'DESTINATION',
    name: trip.destinationCity.name,
    address: label && label !== trip.destinationCity.name ? label : undefined,
  };
}

function stopWaypoint(stop: TripStop): Waypoint {
  return { stopId: stop.id, kind: 'STOP', name: stopName(stop), address: stopAddress(stop) };
}

/** Le trajet a-t-il au moins une réservation payée ? (même règle que le serveur pour « signaler mon arrivée au départ ») */
export function hasPaidReservation(bookings: Booking[]): boolean {
  return bookings.some((booking) => booking.status === 'CONFIRMED' || booking.status === 'PAID');
}

/** Le parcours guidé s'applique-t-il à ce trajet ? Sinon l'écran complet (brouillon, trajet sans réservation, annulé…). */
export function isGuidedTrip(trip: Trip, bookings: Booking[]): boolean {
  switch (trip.status) {
    case 'PUBLISHED':
      return hasPaidReservation(bookings);
    case 'DRIVER_ARRIVED':
    case 'PASSENGER_PICKED_UP':
    case 'IN_PROGRESS':
    case 'ARRIVED':
    case 'COMPLETED':
      return true;
    default:
      return false;
  }
}

/** Places à prendre et à déposer au point visé (pour dire au conducteur ce qui l'attend). */
function peopleAt(waypoint: Waypoint, active: Booking[]): JourneyPeople {
  if (waypoint.kind === 'ORIGIN') {
    return { boarding: seatsOf(active.filter((b) => !b.boardingStopId && !isPickedUp(b))), alighting: 0 };
  }
  if (waypoint.kind === 'STOP') {
    return {
      boarding: seatsOf(active.filter((b) => b.boardingStopId === waypoint.stopId && !isPickedUp(b))),
      alighting: seatsOf(active.filter((b) => b.alightingStopId === waypoint.stopId)),
    };
  }
  return { boarding: 0, alighting: seatsOf(active.filter((b) => isPickedUp(b))) };
}

export function computeJourney(trip: Trip, bookings: Booking[], skipped: ReadonlySet<string> = new Set()): Journey {
  const origin = originWaypoint(trip);
  const destination = destinationWaypoint(trip);
  const stops = sortedStops(trip);

  const onRoute = bookings.filter((booking) => ON_ROUTE_STATUSES.has(booking.status));
  const stopsOnRoute = stops.filter((stop) =>
    onRoute.some((booking) => booking.boardingStopId === stop.id || booking.alightingStopId === stop.id),
  );
  const route: Waypoint[] = [origin, ...stopsOnRoute.map(stopWaypoint), destination];
  const lastIndex = route.length - 1;

  const active = bookings.filter((booking) => booking.status === 'CONFIRMED');
  const indexOfStop = (stopId: string) => route.findIndex((point) => point.stopId === stopId);
  const done = (step: JourneyStep, currentIndex: number): Journey => ({ step, route, currentIndex });

  switch (trip.status) {
    case 'PUBLISHED':
      return done({ kind: 'go_to', waypoint: origin, people: peopleAt(origin, active) }, 0);

    case 'DRIVER_ARRIVED':
    case 'PASSENGER_PICKED_UP': {
      const boardingHere = onRoute.filter((b) => !b.boardingStopId && !skipped.has(b.id));
      const pending = active.filter((b) => !b.boardingStopId && !isPickedUp(b) && !skipped.has(b.id));
      if (pending.length > 0) {
        const alreadyOnBoard = boardingHere.filter((b) => isPickedUp(b)).length;
        return done(
          { kind: 'pickup', waypoint: origin, booking: pending[0], position: alreadyOnBoard + 1, total: boardingHere.length },
          0,
        );
      }
      return done({ kind: 'start', next: route[1] ?? destination }, 0);
    }

    case 'IN_PROGRESS': {
      for (const stop of stopsOnRoute) {
        const waypoint = stopWaypoint(stop);
        const index = indexOfStop(stop.id);
        if (!stop.arrivedAt) return done({ kind: 'go_to', waypoint, people: peopleAt(waypoint, active) }, index);

        // Ceux qui descendent ici d'abord (leur argent est versé), puis ceux qui montent.
        const alightingHere = onRoute.filter((b) => b.alightingStopId === stop.id && !skipped.has(b.id));
        const dropoffs = alightingHere.filter((b) => b.status === 'CONFIRMED');
        if (dropoffs.length > 0) {
          const finished = alightingHere.filter((b) => b.status === 'COMPLETED').length;
          return done(
            {
              kind: 'dropoff',
              waypoint,
              booking: dropoffs[0],
              position: finished + 1,
              total: alightingHere.length,
              pickupMissed: !isPickedUp(dropoffs[0]),
            },
            index,
          );
        }

        const boardingHere = onRoute.filter((b) => b.boardingStopId === stop.id && !skipped.has(b.id));
        const pickups = active.filter((b) => b.boardingStopId === stop.id && !isPickedUp(b) && !skipped.has(b.id));
        if (pickups.length > 0 && !stop.pickupArrivedAt) {
          // Les déposes sont faites : on va chercher les clients qui montent ici avant de leur demander leur code.
          return done({ kind: 'go_to_pickup', waypoint, bookings: pickups }, index);
        }
        if (pickups.length > 0) {
          const alreadyOnBoard = boardingHere.filter((b) => isPickedUp(b)).length;
          return done({ kind: 'pickup', waypoint, booking: pickups[0], position: alreadyOnBoard + 1, total: boardingHere.length }, index);
        }
      }
      return done({ kind: 'go_to', waypoint: destination, people: peopleAt(destination, active) }, lastIndex);
    }

    case 'ARRIVED': {
      const pending = active.filter((b) => !skipped.has(b.id));
      if (pending.length > 0) {
        // Au bout du trajet : ceux qui descendaient au terminus, et ceux dont l'étape de descente a été dépassée.
        const atDestination = onRoute.filter(
          (b) => !skipped.has(b.id) && (b.status === 'CONFIRMED' || (b.status === 'COMPLETED' && !b.alightingStopId)),
        );
        const finished = atDestination.filter((b) => b.status === 'COMPLETED').length;
        return done(
          {
            kind: 'dropoff',
            waypoint: destination,
            booking: pending[0],
            position: finished + 1,
            total: atDestination.length,
            pickupMissed: !isPickedUp(pending[0]),
          },
          lastIndex,
        );
      }
      const leftOpen = active.filter((b) => skipped.has(b.id));
      if (leftOpen.length > 0) return done({ kind: 'blocked', bookings: leftOpen }, lastIndex);
      return done({ kind: 'close' }, lastIndex);
    }

    case 'COMPLETED':
      return done({ kind: 'completed' }, lastIndex);

    default:
      return done({ kind: 'unavailable' }, 0);
  }
}

/**
 * Ce que le conducteur reçoit pour cette réservation : le prix qu'il a fixé × le nombre de places (la commission de la plateforme
 * est payée en plus par le client). Versé sur son solde disponible dès que la dépose est validée.
 */
export function bookingEarning(booking: Pick<Booking, 'pricePerSeat' | 'seatsCount'>): number {
  const perSeat = Number(booking.pricePerSeat);
  return Number.isFinite(perSeat) ? perSeat * booking.seatsCount : 0;
}

/** Montant à afficher pour une réservation, dans la devise du trajet — null si elle diffère (conversion faite par le serveur). */
export function earningLabelData(trip: Trip, booking: Booking): { amount: number; currency: string | undefined } | null {
  if (booking.currencyId !== trip.currencyId) return null;
  const amount = bookingEarning(booking);
  return amount > 0 ? { amount, currency: currencyOf(trip) } : null;
}

/** Total versé au conducteur pour les réservations terminées du trajet — null s'il n'y en a pas ou si les devises diffèrent. */
export function tripEarnings(trip: Trip, bookings: Booking[]): { amount: number; currency: string | undefined } | null {
  const completed = bookings.filter((booking) => booking.status === 'COMPLETED');
  if (completed.length === 0 || completed.some((booking) => booking.currencyId !== trip.currencyId)) return null;
  const amount = completed.reduce((sum, booking) => sum + bookingEarning(booking), 0);
  return amount > 0 ? { amount, currency: currencyOf(trip) } : null;
}

/** « Boubacar BARRY », ou « 2 places » si aucun nom n'est connu. */
export function passengerLabel(booking: Booking): string {
  const names = booking.passengers?.map((passenger) => passenger.fullName).filter(Boolean) ?? [];
  return names.length > 0 ? names.join(', ') : `${booking.seatsCount} place${booking.seatsCount > 1 ? 's' : ''}`;
}
