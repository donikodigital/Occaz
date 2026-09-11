// mobile/src/services/api/locations.api.ts
import { api } from './client';
import type { TripLocation } from '@/types/trips.types';
import type { CreateLocationPayload } from '@/types/locations.types';

export const locationsApi = {
  create: (payload: CreateLocationPayload) => api.post<TripLocation>('/locations', payload),
};
