// mobile/src/types/locations.types.ts
export type GeocodeTrust = 'GPS' | 'MANUAL' | 'APPROXIMATE';

export interface CreateLocationPayload {
  label: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  geocodeTrust?: GeocodeTrust;
  cityId?: string;
}
