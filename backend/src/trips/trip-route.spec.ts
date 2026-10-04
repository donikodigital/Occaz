// backend/src/trips/trip-route.spec.ts
import {
  RouteStopInput,
  RouteTripInput,
  buildRoute,
  computeAutoFares,
  estimateArrivalAt,
  interpolateFare,
  matchRoute,
  matchRouteFromCity,
  matchRouteToCity,
  rescaleFares,
  resolveSegment,
  routeCityIds,
  validateStopFare,
} from './trip-route';

const DEPARTURE = new Date('2026-10-10T06:00:00.000Z');

const stop = (id: string, sequence: number, cityId: string | null, fare: bigint | null, extra: Partial<RouteStopInput> = {}): RouteStopInput => ({
  id,
  sequence,
  cityId,
  locationId: `loc-${id}`,
  fareFromOrigin: fare,
  distanceFromOriginKm: null,
  estimatedArrivalAt: new Date(DEPARTURE.getTime() + sequence * 3_600_000),
  isBookable: true,
  ...extra,
});

// Conakry → (Kindia 35 000, Mamou 65 000) → Labé 100 000
function trip(stops: RouteStopInput[] = [stop('s-kindia', 1, 'kindia', 35_000n), stop('s-mamou', 2, 'mamou', 65_000n)]): RouteTripInput {
  return {
    pricePerSeat: 100_000n,
    departureAt: DEPARTURE,
    originCityId: 'conakry',
    originLocationId: 'loc-conakry',
    destinationCityId: 'labe',
    destinationLocationId: 'loc-labe',
    stops,
  };
}

describe('buildRoute', () => {
  it('ordonne départ → étapes → arrivée, avec le prix du trajet à l\'arrivée', () => {
    const route = buildRoute(trip());
    expect(route.map((p) => p.cityId)).toEqual(['conakry', 'kindia', 'mamou', 'labe']);
    expect(route.map((p) => p.fareFromOrigin)).toEqual([0n, 35_000n, 65_000n, 100_000n]);
    expect(route.map((p) => p.index)).toEqual([0, 1, 2, 3]);
  });

  it('trie les étapes par ordre de passage même si elles arrivent désordonnées', () => {
    const route = buildRoute(trip([stop('s-mamou', 2, 'mamou', 65_000n), stop('s-kindia', 1, 'kindia', 35_000n)]));
    expect(route.map((p) => p.cityId)).toEqual(['conakry', 'kindia', 'mamou', 'labe']);
  });

  it('une étape sans ville ou sans prix (ancien trajet) n\'est pas réservable mais reste dans la route', () => {
    const route = buildRoute(trip([stop('s-old', 1, null, null), stop('s-nofare', 2, 'mamou', null)]));
    expect(route).toHaveLength(4);
    expect(route[1].isBookable).toBe(false);
    expect(route[2].isBookable).toBe(false);
  });

  it('une étape décochée par le conducteur n\'est pas réservable', () => {
    const route = buildRoute(trip([stop('s-kindia', 1, 'kindia', 35_000n, { isBookable: false })]));
    expect(route[1].isBookable).toBe(false);
  });
});

describe('resolveSegment — prix d\'un tronçon', () => {
  const route = buildRoute(trip());

  it('trajet entier : le prix du trajet, aucun changement pour les réservations existantes', () => {
    const result = resolveSegment(route, null, null);
    expect(result.ok && result.segment.pricePerSeat).toBe(100_000n);
    expect(result.ok && result.segment.isFullTrip).toBe(true);
  });

  it('Kindia → Labé : la différence des deux prix cumulés', () => {
    const result = resolveSegment(route, 's-kindia', null);
    expect(result.ok && result.segment.pricePerSeat).toBe(65_000n);
    expect(result.ok && result.segment.isFullTrip).toBe(false);
  });

  it('Conakry → Mamou et Kindia → Mamou', () => {
    const toMamou = resolveSegment(route, null, 's-mamou');
    const kindiaToMamou = resolveSegment(route, 's-kindia', 's-mamou');
    expect(toMamou.ok && toMamou.segment.pricePerSeat).toBe(65_000n);
    expect(kindiaToMamou.ok && kindiaToMamou.segment.pricePerSeat).toBe(30_000n);
  });

  it('deux clients qui se partagent un siège paient ensemble exactement le prix du trajet', () => {
    const first = resolveSegment(route, null, 's-kindia');
    const second = resolveSegment(route, 's-kindia', null);
    expect(first.ok && second.ok && first.segment.pricePerSeat + second.segment.pricePerSeat).toBe(100_000n);
  });

  it('l\'heure de montée est l\'heure estimée de passage à l\'étape', () => {
    const result = resolveSegment(route, 's-kindia', null);
    expect(result.ok && result.segment.boardingAt).toEqual(new Date(DEPARTURE.getTime() + 3_600_000));
  });

  it('refuse une descente avant la montée', () => {
    expect(resolveSegment(route, 's-mamou', 's-kindia')).toEqual({ ok: false, reason: 'WRONG_ORDER' });
    expect(resolveSegment(route, 's-kindia', 's-kindia')).toEqual({ ok: false, reason: 'WRONG_ORDER' });
  });

  it('refuse une étape inconnue ou qui ne prend pas de passagers', () => {
    expect(resolveSegment(route, 'inconnue', null)).toEqual({ ok: false, reason: 'UNKNOWN_STOP' });
    const closed = buildRoute(trip([stop('s-kindia', 1, 'kindia', 35_000n, { isBookable: false })]));
    expect(resolveSegment(closed, 's-kindia', null)).toEqual({ ok: false, reason: 'NOT_BOOKABLE' });
  });

  it('un tronçon n\'est jamais gratuit : plancher de 1, ou du minimum configuré', () => {
    const flat = buildRoute(trip([stop('a', 1, 'kindia', 35_000n), stop('b', 2, 'mamou', 35_000n)]));
    const free = resolveSegment(flat, 'a', 'b');
    expect(free.ok && free.segment.pricePerSeat).toBe(1n);
    const withMin = resolveSegment(flat, 'a', 'b', 500n);
    expect(withMin.ok && withMin.segment.pricePerSeat).toBe(500n);
  });
});

describe('matchRoute — recherche par villes', () => {
  const route = buildRoute(trip());

  it('trouve le trajet pour un client de Kindia qui va à Labé', () => {
    const match = matchRoute(route, 'kindia', 'labe');
    expect(match?.from.stopId).toBe('s-kindia');
    expect(match?.to.kind).toBe('DESTINATION');
    expect(match?.pricePerSeat).toBe(65_000n);
  });

  it('trouve départ → étape, et étape → étape', () => {
    expect(matchRoute(route, 'conakry', 'mamou')?.pricePerSeat).toBe(65_000n);
    expect(matchRoute(route, 'kindia', 'mamou')?.pricePerSeat).toBe(30_000n);
  });

  it('ne trouve rien dans le mauvais sens (Labé → Kindia) ni pour une ville hors route', () => {
    expect(matchRoute(route, 'labe', 'kindia')).toBeNull();
    expect(matchRoute(route, 'mamou', 'kindia')).toBeNull();
    expect(matchRoute(route, 'dakar', 'labe')).toBeNull();
  });

  it('ignore une étape non réservable pour les passagers, mais pas pour les colis', () => {
    const closed = buildRoute(trip([stop('s-kindia', 1, 'kindia', 35_000n, { isBookable: false })]));
    expect(matchRoute(closed, 'kindia', 'labe')).toBeNull();
    expect(matchRoute(closed, 'kindia', 'labe', { requireBookable: false })).not.toBeNull();
  });

  it('retrouve toujours le trajet direct Conakry → Labé', () => {
    expect(matchRoute(route, 'conakry', 'labe')?.isFullTrip).toBe(true);
  });

  it('routeCityIds donne les villes dans l\'ordre', () => {
    expect(routeCityIds(route)).toEqual(['conakry', 'kindia', 'mamou', 'labe']);
  });
});

describe('computeAutoFares — prix automatiques au prorata de la distance', () => {
  it('Kindia à 135 km et Mamou à 270 km sur 430 km : prix au prorata, arrondis à 500', () => {
    const fares = computeAutoFares(100_000n, [135, 270], 430, 500);
    // 135/430 → 31 395 → 31 500 ; 270/430 → 62 790 → 63 000
    expect(fares).toEqual([31_500n, 63_000n]);
  });

  it('jamais décroissants, jamais au-dessus du prix du trajet', () => {
    const fares = computeAutoFares(100_000n, [10, 10.1, 500], 430, 500);
    expect(fares[1]).toBeGreaterThanOrEqual(fares[0]);
    expect(fares[2]).toBeLessThanOrEqual(100_000n);
  });

  it('sans distance exploitable, répartit les étapes à égale distance', () => {
    expect(computeAutoFares(90_000n, [0, 0, 0], 0, 500)).toEqual([22_500n, 45_000n, 67_500n]);
  });
});

describe('rescaleFares / interpolateFare / validateStopFare / estimateArrivalAt', () => {
  it('rescaleFares garde les proportions quand le prix du trajet change', () => {
    expect(rescaleFares(100_000n, 120_000n, [35_000n, 65_000n])).toEqual([42_000n, 78_000n]);
    expect(rescaleFares(100_000n, 120_000n, [null, 65_000n])).toEqual([null, 78_000n]);
  });

  it('interpolateFare place une nouvelle étape entre ses voisins', () => {
    expect(interpolateFare(35_000n, 65_000n, 135, 270, 202.5)).toBe(50_000n);
    expect(interpolateFare(35_000n, 65_000n, 135, 270, 999)).toBe(65_000n);
  });

  it('validateStopFare : le prix reste entre ceux des voisins', () => {
    const route = buildRoute(trip());
    expect(validateStopFare(route, 's-kindia', 40_000n)).toEqual({ ok: true });
    expect(validateStopFare(route, 's-kindia', 70_000n)).toEqual({ ok: false, min: 0n, max: 65_000n });
    expect(validateStopFare(route, 's-mamou', 20_000n)).toEqual({ ok: false, min: 35_000n, max: 100_000n });
  });

  it('estimateArrivalAt : départ + distance par la route ÷ vitesse moyenne', () => {
    // 110 km × 1,3 ÷ 55 km/h = 2 h 36 min
    const at = estimateArrivalAt(DEPARTURE, 110, 1.3, 55);
    expect(at.getTime() - DEPARTURE.getTime()).toBe(Math.round(2.6 * 3_600_000));
  });
});

describe('matchRouteToCity / matchRouteFromCity — recherche avec une seule ville', () => {
  const route = buildRoute(trip());

  it('vers Labé (arrivée) : tronçon du départ à Labé, au prix du trajet', () => {
    const match = matchRouteToCity(route, 'labe');
    expect(match?.from.kind).toBe('ORIGIN');
    expect(match?.isFullTrip).toBe(true);
    expect(match?.pricePerSeat).toBe(100_000n);
  });

  it('vers Mamou (ville traversée) : tronçon du départ à Mamou, au prix de l\'étape', () => {
    const match = matchRouteToCity(route, 'mamou');
    expect(match?.from.kind).toBe('ORIGIN');
    expect(match?.to.stopId).toBe('s-mamou');
    expect(match?.pricePerSeat).toBe(65_000n);
    expect(match?.isFullTrip).toBe(false);
  });

  it('vers la ville de départ du trajet, ou une ville hors route : rien', () => {
    expect(matchRouteToCity(route, 'conakry')).toBeNull();
    expect(matchRouteToCity(route, 'dakar')).toBeNull();
  });

  it('une étape fermée aux passagers ne compte pas (sauf pour les colis)', () => {
    const closed = buildRoute(trip([stop('s-kindia', 1, 'kindia', 35_000n, { isBookable: false })]));
    expect(matchRouteToCity(closed, 'kindia')).toBeNull();
    expect(matchRouteToCity(closed, 'kindia', { requireBookable: false })).not.toBeNull();
  });

  it('depuis Kindia : tronçon de Kindia à l\'arrivée ; depuis Conakry : trajet entier', () => {
    const fromKindia = matchRouteFromCity(route, 'kindia');
    expect(fromKindia?.from.stopId).toBe('s-kindia');
    expect(fromKindia?.to.kind).toBe('DESTINATION');
    expect(fromKindia?.pricePerSeat).toBe(65_000n);
    expect(matchRouteFromCity(route, 'conakry')?.isFullTrip).toBe(true);
  });

  it('depuis la ville d\'arrivée ou une ville hors route : rien', () => {
    expect(matchRouteFromCity(route, 'labe')).toBeNull();
    expect(matchRouteFromCity(route, 'dakar')).toBeNull();
  });
});
