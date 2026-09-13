// mobile/src/services/api/geocoding.api.ts
import { api } from './client';
import type { GeocodingSuggestion } from '@/types/geocoding.types';

export const geocodingApi = {
  search: (query: string, countryCode?: string) =>
    api.get<GeocodingSuggestion[]>('/geocoding/search', { query: { query, countryCode } }),

  reverse: (latitude: number, longitude: number) =>
    api.get<GeocodingSuggestion | null>('/geocoding/reverse', { query: { latitude, longitude } }),
};
