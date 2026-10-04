// backend/src/trips/trip-seats.ts
//
// Places d'un trajet, tronçon par tronçon. Une réservation occupe ses places sur les tronçons entre sa montée et sa
// descente ; une fois le client descendu, la place est de nouveau libre pour les tronçons suivants. Ainsi un siège pris de
// Conakry à Kindia peut être revendu de Kindia à Labé.
//
// Route de n points (départ, étapes, arrivée) = n − 1 tronçons : le tronçon i va du point i au point i + 1. Pour réserver
// un trajet entre les points `from` et `to`, il faut qu'il reste assez de places sur CHACUN des tronçons from … to − 1 :
// le tronçon le plus chargé décide. Ce fichier est pur (ni base ni réseau) ; la lecture des réservations et le verrou
// sont dans trip-seats.db.ts.
import type { RoutePoint } from './trip-route';

/** Ce qu'il faut d'une réservation pour compter ses places : combien, et entre quelles étapes (null = départ / arrivée). */
export interface SeatHoldInput {
  seatsCount: number;
  boardingStopId: string | null;
  alightingStopId: string | null;
}

/**
 * Places occupées sur chaque tronçon. Une réservation dont l'étape est introuvable ou dont la montée ne précède pas la
 * descente est comptée sur tout le trajet : mieux vaut une place de moins que deux clients sur le même siège.
 */
export function seatsOccupiedByLeg(route: RoutePoint[], holds: SeatHoldInput[]): number[] {
  const legCount = Math.max(0, route.length - 1);
  const occupied = new Array<number>(legCount).fill(0);

  for (const hold of holds) {
    let from = hold.boardingStopId ? route.findIndex((point) => point.stopId === hold.boardingStopId) : 0;
    let to = hold.alightingStopId ? route.findIndex((point) => point.stopId === hold.alightingStopId) : route.length - 1;
    if (from < 0 || to < 0 || from >= to) {
      from = 0;
      to = route.length - 1;
    }
    for (let leg = from; leg < to; leg += 1) occupied[leg] += hold.seatsCount;
  }
  return occupied;
}

/** Places libres pour un client qui monte au point `fromIndex` et descend au point `toIndex` : le tronçon le plus chargé décide. */
export function freeSeatsOnSegment(
  totalSeats: number,
  occupiedByLeg: number[],
  fromIndex: number,
  toIndex: number,
): number {
  let busiest = 0;
  for (let leg = fromIndex; leg < toIndex && leg < occupiedByLeg.length; leg += 1) {
    busiest = Math.max(busiest, occupiedByLeg[leg]);
  }
  return Math.max(0, totalSeats - busiest);
}

/** Places libres pour le trajet entier (départ → arrivée) — la valeur gardée dans Trip.availableSeats. */
export function freeSeatsOnFullTrip(totalSeats: number, occupiedByLeg: number[]): number {
  return freeSeatsOnSegment(totalSeats, occupiedByLeg, 0, occupiedByLeg.length);
}

export interface LegSeats {
  fromStopId: string | null;
  toStopId: string | null;
  fromIndex: number;
  toIndex: number;
  occupiedSeats: number;
  freeSeats: number;
}

/** Détail par tronçon (de chaque point au suivant), pour que le conducteur voie où il reste de la place. */
export function seatsByLeg(route: RoutePoint[], occupiedByLeg: number[], totalSeats: number): LegSeats[] {
  return occupiedByLeg.map((occupied, leg) => ({
    fromStopId: route[leg].stopId,
    toStopId: route[leg + 1].stopId,
    fromIndex: leg,
    toIndex: leg + 1,
    occupiedSeats: occupied,
    freeSeats: Math.max(0, totalSeats - occupied),
  }));
}
