// mobile/src/utils/tripSegment.ts
//
// Tronçon d'une réservation : où le client monte et où il descend (étapes), pour afficher « Kindia → Labé » au lieu du
// trajet entier « Conakry → Labé ». Sans étape (montée au départ, descente à l'arrivée), on retrouve le trajet entier.
import type { Booking } from '@/types/bookings.types';
import type { Trip, TripStop } from '@/types/trips.types';

type BookingWithTrip = Pick<Booking, 'boardingStop' | 'alightingStop'> & { trip?: Trip };

/**
 * Places libres que voit le client : celles de SON tronçon (une place prise de Conakry à Kindia est libre de Kindia à
 * Labé), à défaut le compteur du trajet — qui vaut pour le trajet entier.
 */
export function segmentAvailableSeats(trip: Pick<Trip, 'availableSeats' | 'segment'>): number {
  return trip.segment?.availableSeats ?? trip.availableSeats;
}

/** Nom d'une étape : sa ville, à défaut le libellé de l'adresse. */
export function stopName(stop: TripStop): string {
  return stop.city?.name ?? stop.location?.label ?? 'Étape';
}

export function bookingRoute(booking: BookingWithTrip): { from: string; to: string } | null {
  const trip = booking.trip;
  if (!trip) return null;
  return {
    from: booking.boardingStop ? stopName(booking.boardingStop) : trip.originCity.name,
    to: booking.alightingStop ? stopName(booking.alightingStop) : trip.destinationCity.name,
  };
}

export function bookingRouteLabel(booking: BookingWithTrip): string | undefined {
  const route = bookingRoute(booking);
  return route ? `${route.from} → ${route.to}` : undefined;
}

/** Vrai quand le client ne fait qu'une partie du trajet du conducteur. */
export function isPartialBooking(booking: Pick<Booking, 'boardingStop' | 'alightingStop' | 'boardingStopId' | 'alightingStopId'>): boolean {
  return Boolean(booking.boardingStop || booking.alightingStop || booking.boardingStopId || booking.alightingStopId);
}

/** Heure à laquelle le client est pris en charge : passage estimé à son étape, sinon départ du trajet. */
export function bookingBoardingAt(booking: BookingWithTrip): string | undefined {
  return booking.boardingStop?.estimatedArrivalAt ?? booking.trip?.departureAt;
}
