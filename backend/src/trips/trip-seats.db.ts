// backend/src/trips/trip-seats.db.ts
//
// Partie « base de données » des places par tronçon : verrou du trajet, lecture des réservations qui occupent des places,
// et recalcul de Trip.availableSeats. Toutes les fonctions prennent le client de la transaction en cours, pour que le
// contrôle des places et l'écriture de la réservation se fassent dans la même transaction.
import { BookingStatus, Prisma, TripStatus } from '@prisma/client';
import { buildRoute } from './trip-route';
import { freeSeatsOnFullTrip, seatsOccupiedByLeg, type SeatHoldInput } from './trip-seats';

/**
 * Réservations qui occupent des places : toutes sauf les annulées. Une réservation terminée ou remboursée garde sa place
 * (comme avant : le compteur ne remontait qu'à l'annulation) ; seule une annulation (client, conducteur, expiration,
 * litige) libère le siège.
 */
export const SEAT_HOLDING_STATUSES: BookingStatus[] = Object.values(BookingStatus).filter(
  (status) => status !== BookingStatus.CANCELLED,
);

export const SEAT_HOLD_SELECT = { seatsCount: true, boardingStopId: true, alightingStopId: true } as const;

/**
 * Verrouille la ligne du trajet jusqu'à la fin de la transaction : deux clients qui réservent en même temps, ou une
 * réservation et une annulation, passent l'un après l'autre. Renvoie le statut et le nombre de places, ou null si le
 * trajet n'existe pas.
 */
export async function lockTrip(
  tx: Prisma.TransactionClient,
  tripId: string,
): Promise<{ status: TripStatus; totalSeats: number } | null> {
  const rows = await tx.$queryRaw<Array<{ status: TripStatus; totalSeats: number }>>`
    SELECT "status", "totalSeats" FROM "trips" WHERE "id" = ${tripId} FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function loadSeatHolds(tx: Prisma.TransactionClient, tripId: string): Promise<SeatHoldInput[]> {
  return tx.booking.findMany({
    where: { tripId, status: { in: SEAT_HOLDING_STATUSES } },
    select: SEAT_HOLD_SELECT,
  });
}

/**
 * Recalcule Trip.availableSeats à partir des réservations : le nombre de places libres sur le tronçon le plus chargé
 * (= places libres pour le trajet entier). À appeler dans la transaction, après tout changement de réservation
 * (création, annulation, expiration). Recalculer plutôt qu'incrémenter évite toute dérive : jouer deux fois la même
 * annulation donne le même résultat.
 */
export async function syncTripSeats(tx: Prisma.TransactionClient, tripId: string): Promise<number | null> {
  const locked = await lockTrip(tx, tripId);
  if (!locked) return null;

  const trip = await tx.trip.findUnique({
    where: { id: tripId },
    include: { stops: { orderBy: { sequence: 'asc' } } },
  });
  if (!trip) return null;

  const holds = await loadSeatHolds(tx, tripId);
  const free = freeSeatsOnFullTrip(trip.totalSeats, seatsOccupiedByLeg(buildRoute(trip), holds));
  await tx.trip.update({ where: { id: tripId }, data: { availableSeats: free } });
  return free;
}
