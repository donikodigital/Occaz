// mobile/src/types/location-picker.types.ts
import type { City } from './geography.types';
import type { TripLocation } from './trips.types';

/** Adresse déjà utilisée par l'utilisateur — GET /locations/saved. */
export interface SavedLocation extends TripLocation {
  cityName: string | null;
  usageCount: number;
  lastUsedAt: string;
}

/** Réponse de GET /locations/resolve-city : `city` vaut null quand rien de fiable n'a été trouvé. */
export interface ResolveCityResponse {
  city: City | null;
}

export interface ResolveCityParams {
  latitude?: number;
  longitude?: number;
  /** Libellé + adresse complète : sert à retrouver la ville par son nom. */
  address?: string;
}