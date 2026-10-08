// mobile/src/components/home/routePoint.ts
//
// [08/10/2026] v1 — Point de la carte de l'accueil : les coordonnées exactes de l'adresse du trajet si elles existent ; sinon (adresse
// saisie à la main, sans GPS) le centre de la ville, pour que la carte s'affiche quand même. null si ni l'un ni l'autre n'est connu.
import type { RouteMapPoint } from '@/components/ui';

interface Coordinates {
  latitude?: number | null;
  longitude?: number | null;
}

export function routePoint(
  location: Coordinates | null | undefined,
  city: (Coordinates & { name: string }) | null | undefined,
): RouteMapPoint | null {
  const label = city?.name ?? '';
  if (location?.latitude != null && location.longitude != null) {
    return { latitude: location.latitude, longitude: location.longitude, label };
  }
  if (city?.latitude != null && city.longitude != null) {
    return { latitude: city.latitude, longitude: city.longitude, label };
  }
  return null;
}