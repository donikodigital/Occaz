// mobile/src/services/api/trips.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { SearchTripsParams, Trip } from '@/types/trips.types';

export const tripsApi = {
  search: (params: SearchTripsParams) =>
    api.get<Paginated<Trip>>('/trips/search', { query: params as Record<string, string | number | boolean | undefined> }),

  getOne: (id: string) => api.get<Trip>(`/trips/${id}`),
};
