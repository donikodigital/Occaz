// backend/src/integrations/geocoding/geocoding-provider.interface.ts
/**
 * Abstraction du fournisseur de géocodage — même principe que
 * SmsProvider (src/integrations/sms) : le reste de l'application ne
 * connaît que ce contrat, jamais le SDK ou le format de réponse d'un
 * prestataire précis. Permet de remplacer Mapbox par un autre
 * fournisseur (HERE, Google...) sans toucher au module Geocoding qui
 * l'utilise.
 */
export const GEOCODING_PROVIDER = 'GEOCODING_PROVIDER';

export interface GeocodingSuggestion {
  /** Toujours dérivé de la réponse du fournisseur, jamais stocké tel quel côté backend — voir la note sur le géocodage "temporaire" dans mapbox-geocoding.provider.ts. */
  label: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

export interface GeocodingProvider {
  /** @param countryCode Code ISO 3166-1 alpha-2 (ex: "gn") — restreint la recherche à un pays, réduit le bruit sur des libellés courts. */
  search(query: string, countryCode?: string): Promise<GeocodingSuggestion[]>;

  reverseGeocode(latitude: number, longitude: number): Promise<GeocodingSuggestion | null>;
}
