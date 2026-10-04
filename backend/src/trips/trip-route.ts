// backend/src/trips/trip-route.ts
//
// Route d'un trajet = départ → étapes (villes traversées) → arrivée. Ce fichier ne touche ni la base ni le réseau :
// il décrit la route, résout un tronçon (« je monte à Kindia, je descends à Labé »), calcule son prix, propose les
// prix automatiques des étapes et dit si deux villes se suivent sur la route. Les services (trajets, réservations,
// envois) s'en servent pour que passagers et colis suivent exactement les mêmes règles.
//
// Principe de prix : chaque étape porte le prix d'une place DEPUIS LE DÉPART (fareFromOrigin, croissant). Le prix d'un
// tronçon est la différence entre ses deux extrémités : départ = 0, arrivée = prix du trajet entier. Ainsi deux clients
// qui se partagent un siège (Conakry → Kindia, puis Kindia → Labé) paient ensemble exactement le prix du trajet.

export interface RouteStopInput {
  id: string;
  sequence: number;
  cityId: string | null;
  locationId: string;
  fareFromOrigin: bigint | null;
  distanceFromOriginKm: number | null;
  estimatedArrivalAt: Date | null;
  isBookable: boolean;
}

export interface RouteTripInput {
  pricePerSeat: bigint;
  departureAt: Date;
  originCityId: string;
  originLocationId: string;
  destinationCityId: string;
  destinationLocationId: string;
  stops: RouteStopInput[];
}

export interface RoutePoint {
  kind: 'ORIGIN' | 'STOP' | 'DESTINATION';
  /** Position dans la route : 0 = départ, 1..n = étapes, n+1 = arrivée. */
  index: number;
  /** null pour le départ et l'arrivée du trajet. */
  stopId: string | null;
  cityId: string | null;
  locationId: string;
  /** Prix d'une place depuis le départ jusqu'à ce point (0 au départ, prix du trajet à l'arrivée). */
  fareFromOrigin: bigint;
  distanceFromOriginKm: number | null;
  /** Heure estimée de passage (départ : heure de départ ; arrivée : inconnue). */
  at: Date | null;
  /** Peut-on monter / descendre ici ? Toujours vrai au départ et à l'arrivée ; une étape doit avoir ville et prix. */
  isBookable: boolean;
}

export function buildRoute(trip: RouteTripInput): RoutePoint[] {
  const stops = [...trip.stops].sort((a, b) => a.sequence - b.sequence);

  const points: RoutePoint[] = [
    {
      kind: 'ORIGIN',
      index: 0,
      stopId: null,
      cityId: trip.originCityId,
      locationId: trip.originLocationId,
      fareFromOrigin: 0n,
      distanceFromOriginKm: 0,
      at: trip.departureAt,
      isBookable: true,
    },
  ];

  let lastKnownFare = 0n;
  stops.forEach((stop, position) => {
    // Une étape sans prix reprend celui du point précédent : la route reste croissante et ses voisins se comparent bien.
    const fare = stop.fareFromOrigin ?? lastKnownFare;
    lastKnownFare = fare;
    points.push({
      kind: 'STOP',
      index: position + 1,
      stopId: stop.id,
      cityId: stop.cityId,
      locationId: stop.locationId,
      fareFromOrigin: fare,
      distanceFromOriginKm: stop.distanceFromOriginKm,
      at: stop.estimatedArrivalAt,
      // Une étape sans ville ou sans prix (ancien trajet, étape incomplète) reste dans la route mais n'est pas réservable.
      isBookable: stop.isBookable && stop.cityId !== null && stop.fareFromOrigin !== null,
    });
  });

  points.push({
    kind: 'DESTINATION',
    index: stops.length + 1,
    stopId: null,
    cityId: trip.destinationCityId,
    locationId: trip.destinationLocationId,
    fareFromOrigin: trip.pricePerSeat,
    distanceFromOriginKm: null,
    at: null,
    isBookable: true,
  });

  return points;
}

// ---------------------------------------------------------------------------
// Tronçon réservé
// ---------------------------------------------------------------------------

export interface RouteSegment {
  from: RoutePoint;
  to: RoutePoint;
  /** Prix d'une place sur ce tronçon, avant commission. */
  pricePerSeat: bigint;
  /** Heure estimée de passage au point de montée. */
  boardingAt: Date | null;
  /** Vrai pour le trajet entier (départ → arrivée). */
  isFullTrip: boolean;
}

export type SegmentFailure = 'UNKNOWN_STOP' | 'NOT_BOOKABLE' | 'WRONG_ORDER';

export const SEGMENT_FAILURE_MESSAGES: Record<SegmentFailure, string> = {
  UNKNOWN_STOP: "Cette étape ne fait pas partie de ce trajet.",
  NOT_BOOKABLE: "Le conducteur ne prend pas de passagers à cette étape.",
  WRONG_ORDER: "La ville de descente doit se situer après la ville de montée sur la route du trajet.",
};

export type SegmentResult = { ok: true; segment: RouteSegment } | { ok: false; reason: SegmentFailure };

/**
 * `boardingStopId` / `alightingStopId` : null ou absent = départ (montée) / arrivée (descente) du trajet.
 * `minPrice` : plancher du prix d'un tronçon (jamais en dessous de 1, un tronçon n'est jamais gratuit).
 */
export function resolveSegment(
  route: RoutePoint[],
  boardingStopId: string | null | undefined,
  alightingStopId: string | null | undefined,
  minPrice = 1n,
): SegmentResult {
  const from = boardingStopId ? route.find((point) => point.stopId === boardingStopId) : route[0];
  const to = alightingStopId ? route.find((point) => point.stopId === alightingStopId) : route[route.length - 1];
  if (!from || !to) return { ok: false, reason: 'UNKNOWN_STOP' };
  if (!from.isBookable || !to.isBookable) return { ok: false, reason: 'NOT_BOOKABLE' };
  if (from.index >= to.index) return { ok: false, reason: 'WRONG_ORDER' };

  return { ok: true, segment: buildSegment(route, from, to, minPrice) };
}

function buildSegment(route: RoutePoint[], from: RoutePoint, to: RoutePoint, minPrice: bigint): RouteSegment {
  const isFullTrip = from.index === 0 && to.index === route.length - 1;
  const total = route[route.length - 1].fareFromOrigin;

  let price = to.fareFromOrigin - from.fareFromOrigin;
  const floor = minPrice < 1n ? 1n : minPrice;
  if (price < floor) price = floor;
  // Un tronçon ne coûte jamais plus que le trajet entier (sauf si le plancher dépasse le prix du trajet lui-même).
  if (price > total && total >= floor) price = total;
  if (isFullTrip) price = total;

  return { from, to, pricePerSeat: price, boardingAt: from.at, isFullTrip };
}

/**
 * Cherche, sur la route, un tronçon qui va de la ville `originCityId` à la ville `destinationCityId` (dans cet ordre).
 * `requireBookable: false` pour les colis, qui n'ont pas besoin que l'étape accepte des passagers.
 */
export function matchRoute(
  route: RoutePoint[],
  originCityId: string,
  destinationCityId: string,
  options: { requireBookable?: boolean; minPrice?: bigint } = {},
): RouteSegment | null {
  const requireBookable = options.requireBookable ?? true;
  const usable = (point: RoutePoint) => point.cityId !== null && (!requireBookable || point.isBookable);

  for (const from of route) {
    if (from.cityId !== originCityId || !usable(from)) continue;
    const to = route.find(
      (point) => point.index > from.index && point.cityId === destinationCityId && usable(point),
    );
    if (to) return buildSegment(route, from, to, options.minPrice ?? 1n);
  }
  return null;
}

/** Villes de la route dans l'ordre (utile pour les colis : ramassage avant livraison). */
export function routeCityIds(route: RoutePoint[]): string[] {
  return route.map((point) => point.cityId).filter((cityId): cityId is string => cityId !== null);
}

// ---------------------------------------------------------------------------
// Prix automatiques
// ---------------------------------------------------------------------------

function roundToStep(value: number, step: number): bigint {
  if (!Number.isFinite(value)) return 0n;
  const safeStep = step >= 1 ? step : 1;
  return BigInt(Math.round(value / safeStep)) * BigInt(Math.round(safeStep));
}

function clampFare(fare: bigint, pricePerSeat: bigint): bigint {
  if (fare < 0n) return 0n;
  return fare > pricePerSeat ? pricePerSeat : fare;
}

/**
 * Prix proposés pour les étapes, au prorata de la distance parcourue depuis le départ.
 * `cumulativeKm[i]` = distance du départ à l'étape i (croissante) ; `totalKm` = distance du départ à l'arrivée en
 * passant par toutes les étapes. Arrondi au multiple de `step` le plus proche, jamais décroissant, jamais au-dessus
 * du prix du trajet.
 */
export function computeAutoFares(
  pricePerSeat: bigint,
  cumulativeKm: number[],
  totalKm: number,
  step = 500,
): bigint[] {
  const stopCount = cumulativeKm.length;
  const price = Number(pricePerSeat);
  const fares: bigint[] = [];

  cumulativeKm.forEach((km, position) => {
    // Sans distance exploitable, on répartit les étapes à égale distance les unes des autres.
    const ratio = totalKm > 0 && Number.isFinite(totalKm) ? km / totalKm : (position + 1) / (stopCount + 1);
    let fare = clampFare(roundToStep(price * ratio, step), pricePerSeat);
    const previous = fares[position - 1];
    if (previous !== undefined && fare < previous) fare = previous;
    fares.push(fare);
  });

  return fares;
}

/** Nouveau prix de chaque étape quand le prix du trajet change : mêmes proportions, arrondies. */
export function rescaleFares(
  oldPrice: bigint,
  newPrice: bigint,
  fares: Array<bigint | null>,
  step = 500,
): Array<bigint | null> {
  if (oldPrice <= 0n) return fares;
  let previous = 0n;
  return fares.map((fare) => {
    if (fare === null) return null;
    let scaled = clampFare(roundToStep((Number(fare) * Number(newPrice)) / Number(oldPrice), step), newPrice);
    if (scaled < previous) scaled = previous;
    previous = scaled;
    return scaled;
  });
}

/** Prix d'une étape insérée entre deux points, au prorata de la distance entre ses voisins. */
export function interpolateFare(
  previousFare: bigint,
  nextFare: bigint,
  previousKm: number,
  nextKm: number,
  thisKm: number,
  step = 500,
): bigint {
  const span = nextKm - previousKm;
  const ratio = span > 0 ? Math.min(1, Math.max(0, (thisKm - previousKm) / span)) : 0.5;
  const raw = Number(previousFare) + (Number(nextFare) - Number(previousFare)) * ratio;
  const fare = roundToStep(raw, step);
  if (fare < previousFare) return previousFare;
  return fare > nextFare ? nextFare : fare;
}

/** Heure de passage estimée : départ + distance par la route ÷ vitesse moyenne. */
export function estimateArrivalAt(
  departureAt: Date,
  distanceFromOriginKm: number,
  roadFactor = 1.3,
  averageSpeedKmh = 55,
): Date {
  const speed = averageSpeedKmh > 0 ? averageSpeedKmh : 55;
  const hours = (distanceFromOriginKm * roadFactor) / speed;
  return new Date(departureAt.getTime() + Math.round(hours * 3_600_000));
}

/**
 * Valide une modification de prix d'étape : le prix doit rester entre ceux de ses voisins (le départ vaut 0, l'arrivée
 * vaut le prix du trajet), sinon un tronçon aurait un prix négatif.
 */
export function validateStopFare(
  route: RoutePoint[],
  stopId: string,
  newFare: bigint,
): { ok: true } | { ok: false; min: bigint; max: bigint } {
  const point = route.find((candidate) => candidate.stopId === stopId);
  if (!point) return { ok: false, min: 0n, max: 0n };
  const previous = route[point.index - 1];
  const next = route[point.index + 1];
  const min = previous.fareFromOrigin;
  const max = next.fareFromOrigin;
  return newFare >= min && newFare <= max ? { ok: true } : { ok: false, min, max };
}
