// mobile/src/utils/currentPosition.ts
// [11/10/2026] v1 — position de l'appareil « au mieux » pour une alerte SOS : une position approximative tout de suite vaut mieux qu'une
// position précise dans une minute. Jamais d'exception : sans permission ni signal, on renvoie undefined et l'alerte part quand même.
import * as Location from 'expo-location';

const FRESH_POSITION_TIMEOUT_MS = 6_000;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export async function getBestEffortPosition(): Promise<Coordinates | undefined> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return undefined;

    const lastKnown = await Location.getLastKnownPositionAsync().catch(() => null);
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), FRESH_POSITION_TIMEOUT_MS)),
    ]);
    const position = fresh ?? lastKnown;
    return position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : undefined;
  } catch {
    return undefined;
  }
}
