// backend/src/tracking/tracking-view.ts
// [10/10/2026] v1 — Suivi des colis : règles pures (sans base ni réseau) qui transforment l'état d'un envoi en ce que voit
// l'expéditeur, le destinataire ou toute personne qui a le numéro de suivi.
//
// Ce qui est montré, et à qui :
//   - tout détenteur du numéro : l'étape, les villes de la route (déjà passées / à venir), un historique daté, la position
//     APPROXIMATIVE du colis (arrondie à ~5 km) et le prénom du conducteur. Ni nom, ni téléphone, ni adresse précise.
//   - l'expéditeur (compte connecté) et le support : la même chose avec la position exacte.
// Une position GPS n'existe que pendant un trajet en cours ; sans elle (ou pour un colis transporté hors trajet), le suivi
// reste utile grâce aux villes traversées que le conducteur signale (« entre Kindia et Mamou »).

/** Début de la note d'une ligne d'historique créée quand le conducteur passe dans une ville traversée. */
export const PASSAGE_NOTE_PREFIX = 'Passage à ';

/** Étapes du colis chez le transporteur : le colis est « en transit » entre la prise en charge et la remise. */
export const CARRIED_STATUSES: readonly string[] = ['PICKED_UP', 'IN_TRANSIT', 'DELIVERY_PENDING'];

const TRACKING_PATTERN = /^OCZ[0-9A-F]{10}$/;

/**
 * Accepte les écritures qu'un humain recopie : « OCZ 7F3A 91C2 B0 », « ocz7f3a91c2b0 », « OCZ7F3A91C2B0-02 » (numéro d'un colis,
 * ramené à celui de l'envoi). Renvoie null si ce n'est pas un numéro Occa'Z.
 */
export function normalizeTrackingNumber(input: string | null | undefined): string | null {
  if (!input) return null;
  const compact = input.trim().toUpperCase().replace(/\s+/g, '').replace(/-\d{1,3}$/, '').replace(/[^A-Z0-9]/g, '');
  return TRACKING_PATTERN.test(compact) ? compact : null;
}

// ---------------------------------------------------------------------------
// Étapes
// ---------------------------------------------------------------------------

export const PROGRESS_STEPS = [
  { key: 'PAID', label: 'Confirmé' },
  { key: 'DRIVER', label: 'Conducteur' },
  { key: 'PICKED_UP', label: 'Récupéré' },
  { key: 'IN_TRANSIT', label: 'En route' },
  { key: 'DELIVERED', label: 'Livré' },
] as const;

/** Indice de l'étape en cours dans PROGRESS_STEPS (0 à 4). */
export function progressIndex(status: string): number {
  switch (status) {
    case 'DRIVER_ASSIGNED':
    case 'PICKUP_PENDING':
      return 1;
    case 'PICKED_UP':
      return 2;
    case 'IN_TRANSIT':
    case 'DELIVERY_PENDING':
      return 3;
    case 'DELIVERED':
    case 'COMPLETED':
      return 4;
    default:
      return 0;
  }
}

export type TrackingOutcome = 'ACTIVE' | 'DELIVERED' | 'CANCELLED' | 'INCIDENT';

export function outcomeOf(status: string): TrackingOutcome {
  if (status === 'DELIVERED' || status === 'COMPLETED') return 'DELIVERED';
  if (status === 'CANCELLED' || status === 'REFUNDED') return 'CANCELLED';
  if (status === 'DISPUTED') return 'INCIDENT';
  return 'ACTIVE';
}

export interface ProgressStep {
  key: string;
  label: string;
  state: 'DONE' | 'CURRENT' | 'TODO';
}

export function buildProgress(status: string): ProgressStep[] {
  const current = progressIndex(status);
  const delivered = outcomeOf(status) === 'DELIVERED';
  return PROGRESS_STEPS.map((step, index) => ({
    key: step.key,
    label: step.label,
    state: delivered || index < current ? 'DONE' : index === current ? 'CURRENT' : 'TODO',
  }));
}

// ---------------------------------------------------------------------------
// Route : villes traversées
// ---------------------------------------------------------------------------

export interface JourneyInputPoint {
  cityName: string;
  /** Ramassage, ville traversée ou livraison. */
  kind: 'PICKUP' | 'STOP' | 'DELIVERY';
  /** Quand le conducteur a signalé son arrivée dans cette ville (null tant qu'il n'y est pas). */
  reachedAt: Date | null;
}

export interface JourneyPoint {
  cityName: string;
  kind: 'PICKUP' | 'STOP' | 'DELIVERY';
  state: 'DONE' | 'NEXT' | 'TODO';
  at: Date | null;
}

/**
 * Marque chaque ville « passée » (DONE), « prochaine » (NEXT, une seule) ou « à venir » (TODO). Le ramassage est passé dès que le
 * colis est récupéré ; la livraison, dès qu'il est livré ; une ville traversée, dès que le conducteur y est arrivé — et toute
 * ville AVANT une ville passée l'est aussi (un signal oublié ne laisse pas un trou dans la frise).
 */
export function buildJourney(points: JourneyInputPoint[], status: string, pickedUpAt: Date | null, deliveredAt: Date | null): JourneyPoint[] {
  const delivered = outcomeOf(status) === 'DELIVERED';
  const pickedUp = progressIndex(status) >= 2;

  const reached = points.map((point) => {
    if (point.kind === 'PICKUP') return pickedUp ? (pickedUpAt ?? new Date(0)) : null;
    if (point.kind === 'DELIVERY') return delivered ? (deliveredAt ?? new Date(0)) : null;
    return point.reachedAt;
  });

  let lastReached = -1;
  reached.forEach((value, index) => {
    if (value) lastReached = index;
  });

  return points.map((point, index) => {
    const at = reached[index];
    const done = index <= lastReached;
    const isNext = !done && index === lastReached + 1 && outcomeOf(status) === 'ACTIVE' && (pickedUp || index === 0);
    return {
      cityName: point.cityName,
      kind: point.kind,
      state: done ? 'DONE' : isNext ? 'NEXT' : 'TODO',
      at: at && at.getTime() > 0 ? at : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Où est le colis ?
// ---------------------------------------------------------------------------

export interface TripPositionInput {
  currentLatitude: number | null;
  currentLongitude: number | null;
  currentPositionUpdatedAt: Date | null;
}

/** Dernière position GPS du trajet si elle est assez récente, sinon null. */
export function freshTripPosition(
  trip: TripPositionInput | null | undefined,
  now: Date,
  maxAgeMs: number,
): { latitude: number; longitude: number; updatedAt: Date } | null {
  if (!trip || trip.currentLatitude === null || trip.currentLongitude === null || !trip.currentPositionUpdatedAt) return null;
  if (now.getTime() - trip.currentPositionUpdatedAt.getTime() > maxAgeMs) return null;
  return { latitude: trip.currentLatitude, longitude: trip.currentLongitude, updatedAt: trip.currentPositionUpdatedAt };
}

/** Arrondit une coordonnée à la grille de `step` degrés (0,05° ≈ 5 km) : on voit la zone, pas la rue. */
export function approximateCoordinate(value: number, step = 0.05): number {
  return Math.round(Math.round(value / step) * step * 1e6) / 1e6;
}

export interface WhereIsParcel {
  /** Phrase prête à afficher : « Entre Kindia et Mamou », « Chez l'expéditeur »… */
  label: string;
  /** GPS : le colis est suivi en direct ; CITIES : déduit des villes traversées ; NONE : pas encore en route. */
  source: 'GPS' | 'CITIES' | 'NONE';
  latitude: number | null;
  longitude: number | null;
  updatedAt: Date | null;
  /** Vrai quand les coordonnées sont arrondies (vue publique). */
  isApproximate: boolean;
}

export function whereIsParcel(params: {
  status: string;
  journey: JourneyPoint[];
  gps: { latitude: number; longitude: number; updatedAt: Date } | null;
  precise: boolean;
}): WhereIsParcel {
  const { status, journey, gps, precise } = params;
  const outcome = outcomeOf(status);
  const none = { source: 'NONE' as const, latitude: null, longitude: null, updatedAt: null, isApproximate: false };

  if (outcome === 'DELIVERED') return { label: 'Livré au destinataire', ...none };
  if (outcome === 'CANCELLED') return { label: 'Envoi annulé', ...none };
  if (outcome === 'INCIDENT') return { label: 'Incident en cours de traitement', ...none };
  if (progressIndex(status) < 2) {
    return { label: progressIndex(status) === 1 ? 'En attente de récupération chez l\'expéditeur' : 'Pas encore pris en charge', ...none };
  }

  const done = journey.filter((point) => point.state === 'DONE');
  const last = done[done.length - 1];
  const next = journey.find((point) => point.state === 'NEXT');
  let label: string;
  if (status === 'DELIVERY_PENDING') label = `Arrivé à ${journey[journey.length - 1]?.cityName ?? 'destination'}`;
  else if (last && next) label = last.kind === 'PICKUP' ? `Parti de ${last.cityName}, en route vers ${next.cityName}` : `Entre ${last.cityName} et ${next.cityName}`;
  else if (next) label = `En route vers ${next.cityName}`;
  else label = 'En route';

  if (!gps) return { label, source: 'CITIES', latitude: null, longitude: null, updatedAt: last?.at ?? null, isApproximate: false };
  return {
    label,
    source: 'GPS',
    latitude: precise ? gps.latitude : approximateCoordinate(gps.latitude),
    longitude: precise ? gps.longitude : approximateCoordinate(gps.longitude),
    updatedAt: gps.updatedAt,
    isApproximate: !precise,
  };
}

// ---------------------------------------------------------------------------
// Textes
// ---------------------------------------------------------------------------

/** Phrase d'en-tête de la page de suivi. */
export function headlineFor(params: { status: string; driverFirstName: string | null; deliveryCity: string; where: WhereIsParcel }): string {
  const { status, driverFirstName, deliveryCity, where } = params;
  const driver = driverFirstName ?? 'Le conducteur';
  switch (status) {
    case 'CREATED':
      return 'En attente de paiement';
    case 'SEARCHING_DRIVER':
      return 'Nous cherchons un conducteur pour ce colis';
    case 'DRIVER_ASSIGNED':
      return `${driver} va récupérer le colis`;
    case 'PICKUP_PENDING':
      return `${driver} arrive chez l'expéditeur`;
    case 'PICKED_UP':
      return `Colis récupéré par ${driver}`;
    case 'IN_TRANSIT':
      return where.label;
    case 'DELIVERY_PENDING':
      return `${driver} est arrivé à ${deliveryCity} : remise du colis imminente`;
    case 'DELIVERED':
    case 'COMPLETED':
      return 'Colis livré';
    case 'CANCELLED':
      return 'Envoi annulé';
    case 'REFUNDED':
      return 'Envoi annulé et remboursé';
    case 'DISPUTED':
      return 'Un incident est en cours de traitement';
    default:
      return 'Suivi du colis';
  }
}

/** Libellé d'une ligne d'historique, ou null si la ligne n'a pas à être montrée (doublon ou détail interne). */
export function eventLabel(status: string, note: string | null, context: { pickupCity: string; deliveryCity: string }): string | null {
  if (note && note.startsWith(PASSAGE_NOTE_PREFIX)) return note;
  switch (status) {
    case 'CREATED':
    case 'COMPLETED':
      return null;
    case 'SEARCHING_DRIVER':
      return 'Paiement confirmé · recherche d\'un conducteur';
    case 'DRIVER_ASSIGNED':
      return 'Un conducteur a accepté le colis';
    case 'PICKUP_PENDING':
      return 'Le conducteur arrive pour récupérer le colis';
    case 'PICKED_UP':
      return `Colis récupéré à ${context.pickupCity}`;
    case 'IN_TRANSIT':
      return 'Colis en route';
    case 'DELIVERY_PENDING':
      return `Arrivé à ${context.deliveryCity} · remise imminente`;
    case 'DELIVERED':
      return 'Colis livré';
    case 'CANCELLED':
      return 'Envoi annulé';
    case 'REFUNDED':
      return 'Envoi remboursé';
    case 'DISPUTED':
      return 'Un incident est en cours de traitement';
    default:
      return null;
  }
}
