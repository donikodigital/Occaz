// mobile/src/utils/bookingPhase.ts
//
// Où en est une réservation de trajet, côté conducteur (que doit-il valider ?) et côté client (quel code doit-il voir ?).
// Fonctions pures, partagées par les deux écrans pour qu'ils racontent la même chose.
//
// Principe : un client monte au départ du trajet ou à une étape, et descend à une étape ou à l'arrivée. Prise en charge et dépose se
// valident chacune avec un code que le client donne au conducteur. Si la prise en charge a été oubliée (le conducteur n'a pas
// validé le code à l'étape), la dépose n'est jamais bloquée : un client ne reste pas coincé parce que son conducteur a oublié une
// étape — le code de dépose apparaît chez lui dès que le conducteur est à son étape de descente, ou à l'arrivée.
import type { Booking } from '@/types/bookings.types';
import type { Trip, TripStatus, TripStop } from '@/types/trips.types';
import { stopName } from '@/utils/tripSegment';

export type BookingPhase = 'pickup' | 'dropoff' | 'none';

export function isPickedUp(booking: Pick<Booking, 'passengers'>): boolean {
  return Boolean(booking.passengers?.some((passenger) => passenger.pickedUpAt));
}

function stopOf(trip: Trip, stopId: string | null | undefined): TripStop | undefined {
  return stopId ? trip.stops?.find((stop) => stop.id === stopId) : undefined;
}

/**
 * Ce que le conducteur doit valider pour CE client :
 *  - client du départ : prise en charge quand le conducteur est arrivé au départ ; dépose à l'arrivée ;
 *  - client d'une étape : prise en charge en route, une fois le conducteur arrivé à son étape ; dépose à son étape de descente
 *    (ou à l'arrivée du trajet si le conducteur n'a pas signalé l'étape) ;
 *  - prise en charge oubliée : la dépose reste proposée dès que le conducteur est à l'étape de descente du client, ou à l'arrivée.
 */
export function getBookingPhase(booking: Booking, trip: Trip): BookingPhase {
  if (trip.status === 'ARRIVED') return 'dropoff';

  const atAlightingStop =
    Boolean(booking.alightingStopId) &&
    trip.status === 'IN_PROGRESS' &&
    Boolean(stopOf(trip, booking.alightingStopId)?.arrivedAt);

  if (isPickedUp(booking)) return atAlightingStop ? 'dropoff' : 'none';

  // Pas encore pris en charge.
  if (atAlightingStop) return 'dropoff';
  if (!booking.boardingStopId) {
    return trip.status === 'DRIVER_ARRIVED' || trip.status === 'PASSENGER_PICKED_UP' ? 'pickup' : 'none';
  }
  // Client d'une étape : sa prise en charge s'ouvre quand le conducteur est arrivé SUR LES LIEUX de montée (pickupArrivedAt), pas
  // seulement dans la ville.
  return trip.status === 'IN_PROGRESS' && stopOf(trip, booking.boardingStopId)?.pickupArrivedAt ? 'pickup' : 'none';
}

/** La dépose est proposée alors que la prise en charge de ce client n'a jamais été validée. */
export function isPickupMissed(booking: Booking, trip: Trip): boolean {
  return booking.status === 'CONFIRMED' && !isPickedUp(booking) && getBookingPhase(booking, trip) === 'dropoff';
}

/**
 * Clients dont le conducteur a déjà atteint (puis peut-être dépassé) l'étape de montée sans valider leur prise en charge. Sert à
 * prévenir le conducteur avant qu'il signale l'étape suivante ou l'arrivée : une prise en charge oubliée ne se rattrape plus.
 */
export function unpickedBoarders(trip: Trip, bookings: Booking[]): Booking[] {
  if (trip.status !== 'IN_PROGRESS') return [];
  return bookings.filter(
    (booking) =>
      booking.status === 'CONFIRMED' &&
      Boolean(booking.boardingStopId) &&
      !isPickedUp(booking) &&
      Boolean(stopOf(trip, booking.boardingStopId)?.arrivedAt),
  );
}

/** « Boubacar BARRY (Dalaba) » — pour dire qui n'a pas été pris en charge, et où. */
export function describeUnpicked(booking: Booking, trip: Trip): string {
  const names = booking.passengers?.map((passenger) => passenger.fullName).filter(Boolean) ?? [];
  const who = names.length > 0 ? names.join(', ') : `${booking.seatsCount} place${booking.seatsCount > 1 ? 's' : ''}`;
  const stop = stopOf(trip, booking.boardingStopId);
  return stop ? `${who} (${stopName(stop)})` : who;
}

/**
 * Codes visibles dans l'app du CLIENT. `tripStatus` vient de la réservation (le détail d'un trajet n'est pas joint) ; les étapes
 * de montée et de descente, elles, viennent de la réservation (`boardingStop` / `alightingStop`, avec leur `arrivedAt`).
 *
 *  - code de prise en charge : client du départ, conducteur arrivé au départ ; client d'une étape, conducteur arrivé sur les lieux de
 *    montée de cette étape (pickupArrivedAt) pendant le trajet ;
 *  - code de dépose : à l'arrivée du trajet, ou quand le conducteur est à l'étape de descente du client — et même si la prise en
 *    charge a été oubliée, pour ne jamais bloquer la dépose.
 */
export function customerCodeVisibility(
  booking: Pick<Booking, 'status' | 'passengers' | 'boardingStopId' | 'alightingStopId' | 'boardingStop' | 'alightingStop'>,
  tripStatus: TripStatus | undefined,
): { pickup: boolean; dropoff: boolean } {
  if (booking.status !== 'CONFIRMED' || !tripStatus) return { pickup: false, dropoff: false };

  const picked = isPickedUp(booking);
  const boardsAtStop = Boolean(booking.boardingStopId);
  const running = tripStatus === 'IN_PROGRESS';
  const atBoardingStop = running && Boolean(booking.boardingStop?.pickupArrivedAt);
  const atAlightingStop = running && Boolean(booking.alightingStopId) && Boolean(booking.alightingStop?.arrivedAt);

  const pickup = boardsAtStop
    ? atBoardingStop && !picked
    : tripStatus === 'DRIVER_ARRIVED' || tripStatus === 'PASSENGER_PICKED_UP';

  // [09/10/2026] Le code de dépose n'apparaît qu'à l'arrivée du conducteur au point de descente du client (sa ville, ou la
  // destination) : c'est à ce moment-là que le serveur le lui envoie, avec sa notification. Avant, il s'affichait dès la prise en
  // charge, bien avant d'être utile.
  const dropoff = tripStatus === 'ARRIVED' || atAlightingStop;

  return { pickup, dropoff };
}
