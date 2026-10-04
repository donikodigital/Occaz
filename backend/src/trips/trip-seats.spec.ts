// backend/src/trips/trip-seats.spec.ts
import { RouteStopInput, RouteTripInput, buildRoute } from './trip-route';
import { freeSeatsOnFullTrip, freeSeatsOnSegment, seatsByLeg, seatsOccupiedByLeg, SeatHoldInput } from './trip-seats';

const DEPARTURE = new Date('2026-10-10T06:00:00.000Z');
const stop = (id: string, sequence: number, cityId: string, fare: bigint): RouteStopInput => ({
  id, sequence, cityId, locationId: `loc-${id}`, fareFromOrigin: fare, distanceFromOriginKm: null,
  estimatedArrivalAt: null, isBookable: true,
});

// Conakry (0) → Kindia (1) → Mamou (2) → Labé (3) : 3 tronçons
const trip: RouteTripInput = {
  pricePerSeat: 100_000n, departureAt: DEPARTURE,
  originCityId: 'conakry', originLocationId: 'l0', destinationCityId: 'labe', destinationLocationId: 'l3',
  stops: [stop('s-kindia', 1, 'kindia', 35_000n), stop('s-mamou', 2, 'mamou', 65_000n)],
};
const route = buildRoute(trip);

const hold = (seatsCount: number, boardingStopId: string | null, alightingStopId: string | null): SeatHoldInput => ({
  seatsCount, boardingStopId, alightingStopId,
});

describe('seatsOccupiedByLeg', () => {
  it('une réservation du trajet entier occupe tous les tronçons', () => {
    expect(seatsOccupiedByLeg(route, [hold(2, null, null)])).toEqual([2, 2, 2]);
  });

  it('une réservation partielle n\'occupe que ses tronçons', () => {
    expect(seatsOccupiedByLeg(route, [hold(1, null, 's-kindia')])).toEqual([1, 0, 0]);
    expect(seatsOccupiedByLeg(route, [hold(1, 's-kindia', null)])).toEqual([0, 1, 1]);
    expect(seatsOccupiedByLeg(route, [hold(3, 's-kindia', 's-mamou')])).toEqual([0, 3, 0]);
  });

  it('additionne les réservations qui se chevauchent', () => {
    const holds = [hold(1, null, 's-mamou'), hold(2, 's-kindia', null), hold(1, null, null)];
    expect(seatsOccupiedByLeg(route, holds)).toEqual([2, 4, 3]);
  });

  it('une étape introuvable ou une montée après la descente compte sur tout le trajet (jamais deux clients sur un siège)', () => {
    expect(seatsOccupiedByLeg(route, [hold(1, 'etape-supprimee', null)])).toEqual([1, 1, 1]);
    expect(seatsOccupiedByLeg(route, [hold(1, 's-mamou', 's-kindia')])).toEqual([1, 1, 1]);
  });

  it('sans étape : un seul tronçon, comportement d\'avant', () => {
    const direct = buildRoute({ ...trip, stops: [] });
    expect(seatsOccupiedByLeg(direct, [hold(2, null, null), hold(1, null, null)])).toEqual([3]);
  });
});

describe('freeSeatsOnSegment — le tronçon le plus chargé décide', () => {
  it('le siège pris de Conakry à Kindia est de nouveau libre de Kindia à Labé', () => {
    // 4 places, 4 clients de Conakry → Kindia : plein sur le 1er tronçon, vide ensuite
    const occupied = seatsOccupiedByLeg(route, [hold(4, null, 's-kindia')]);
    expect(freeSeatsOnSegment(4, occupied, 1, 3)).toBe(4); // Kindia → Labé : 4 libres
    expect(freeSeatsOnSegment(4, occupied, 0, 1)).toBe(0); // Conakry → Kindia : complet
    expect(freeSeatsOnSegment(4, occupied, 0, 3)).toBe(0); // trajet entier : complet
  });

  it('un tronçon libre mais un tronçon chargé plus loin : la place manque', () => {
    // Kindia → Mamou plein (3/3) : on ne peut pas faire Conakry → Labé, ni Kindia → Labé
    const occupied = seatsOccupiedByLeg(route, [hold(3, 's-kindia', 's-mamou')]);
    expect(freeSeatsOnSegment(3, occupied, 0, 3)).toBe(0);
    expect(freeSeatsOnSegment(3, occupied, 1, 3)).toBe(0);
    expect(freeSeatsOnSegment(3, occupied, 0, 1)).toBe(3); // Conakry → Kindia reste libre
    expect(freeSeatsOnSegment(3, occupied, 2, 3)).toBe(3); // Mamou → Labé reste libre
  });

  it('ne descend jamais sous zéro', () => {
    expect(freeSeatsOnSegment(2, [5, 5, 5], 0, 3)).toBe(0);
  });

  it('exemple complet : un siège revendu trois fois sur la route', () => {
    // 1 place : A Conakry → Kindia, B Kindia → Mamou, C Mamou → Labé — tout tient dans un seul siège
    const occupied = seatsOccupiedByLeg(route, [hold(1, null, 's-kindia'), hold(1, 's-kindia', 's-mamou'), hold(1, 's-mamou', null)]);
    expect(occupied).toEqual([1, 1, 1]);
    expect(freeSeatsOnFullTrip(1, occupied)).toBe(0);
    // un quatrième client ne trouve rien sur aucun tronçon
    expect(freeSeatsOnSegment(1, occupied, 1, 2)).toBe(0);
  });
});

describe('freeSeatsOnFullTrip / seatsByLeg', () => {
  it('Trip.availableSeats = places libres sur le tronçon le plus chargé', () => {
    const occupied = seatsOccupiedByLeg(route, [hold(1, null, 's-kindia'), hold(2, 's-kindia', null)]);
    expect(freeSeatsOnFullTrip(4, occupied)).toBe(2);
  });

  it('seatsByLeg décrit chaque tronçon avec ses places occupées et libres', () => {
    const occupied = seatsOccupiedByLeg(route, [hold(1, null, 's-kindia'), hold(2, 's-kindia', null)]);
    const legs = seatsByLeg(route, occupied, 4);
    expect(legs).toHaveLength(3);
    expect(legs[0]).toMatchObject({ fromStopId: null, toStopId: 's-kindia', occupiedSeats: 1, freeSeats: 3 });
    expect(legs[1]).toMatchObject({ fromStopId: 's-kindia', toStopId: 's-mamou', occupiedSeats: 2, freeSeats: 2 });
    expect(legs[2]).toMatchObject({ fromStopId: 's-mamou', toStopId: null, occupiedSeats: 2, freeSeats: 2 });
  });
});
