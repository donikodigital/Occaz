// mobile/src/services/api/locations.api.ts
import { api } from './client';
import type { TripLocation } from '@/types/trips.types';
import type { CreateLocationPayload } from '@/types/locations.types';
import type { ResolveCityParams, ResolveCityResponse, SavedLocation } from '@/types/location-picker.types';

function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export const locationsApi = {
  /** Crée l'adresse — ou réutilise celle que l'utilisateur a déjà mémorisée — et la mémorise pour lui. */
  create: (payload: CreateLocationPayload) => api.post<TripLocation>('/locations', payload),

  /** Adresses déjà utilisées : les plus récentes sans `query`, sinon celles qui correspondent. */
  saved: (query?: string, limit?: number) =>
    api.get<SavedLocation[]>(`/locations/saved${buildQuery({ query, limit })}`),

  /** Détecte la ville d'une adresse (par son nom, sinon par proximité). */
  resolveCity: (params: ResolveCityParams) =>
    api.get<ResolveCityResponse>(`/locations/resolve-city${buildQuery({ ...params })}`),

  /** Signale qu'une adresse mémorisée vient d'être réutilisée : elle remonte dans les récentes. */
  markUsed: (id: string) => api.post<{ success: boolean }>(`/locations/${id}/use`, {}),
};