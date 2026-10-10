// mobile/src/types/geocoding.types.ts
// Suggestion d'adresse renvoyée par GET /geocoding/search et /geocoding/reverse (même forme que le backend : GeocodingSuggestion).
export interface GeocodingSuggestion {
  label: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}
