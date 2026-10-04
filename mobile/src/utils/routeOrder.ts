// mobile/src/utils/routeOrder.ts
//
// Ordre des villes traversées sur la route d'un trajet : de la plus proche du départ à la plus éloignée. La distance à
// vol d'oiseau suffit pour ranger les villes d'un axe ; les prix et les heures de passage, eux, sont calculés par le
// serveur (distance PostGIS, voir trip-route.planner.ts).
import type { TripLocation } from '@/types/trips.types';

type Point = { latitude: number | null; longitude: number | null };

/** Distance à vol d'oiseau en km, ou null si une des deux adresses n'a pas de coordonnées. */
export function distanceKm(from: Point, to: Point): number | null {
  if (from.latitude == null || from.longitude == null || to.latitude == null || to.longitude == null) return null;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Villes rangées de la plus proche du départ à la plus éloignée (ordre d'origine conservé si une distance manque). */
export function sortByDistanceFrom<T extends Point>(origin: Point | null | undefined, items: T[]): T[] {
  if (!origin) return items;
  return [...items].sort((a, b) => (distanceKm(origin, a) ?? 0) - (distanceKm(origin, b) ?? 0));
}

/** Position (1, 2, 3…) à donner à une nouvelle ville parmi des étapes déjà rangées dans l'ordre de la route. */
export function insertionSequence(
  origin: Point | null | undefined,
  existing: Array<{ location?: TripLocation | null }>,
  added: Point,
): number {
  if (!origin) return existing.length + 1;
  const addedKm = distanceKm(origin, added);
  if (addedKm === null) return existing.length + 1;
  const before = existing.filter((stop) => {
    const km = stop.location ? distanceKm(origin, stop.location) : null;
    return km !== null && km < addedKm;
  });
  return before.length + 1;
}
