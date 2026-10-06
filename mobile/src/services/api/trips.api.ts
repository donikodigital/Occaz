// mobile/src/services/api/trips.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { Booking } from '@/types/bookings.types';
import type {
  CancelTripPayload,
  CreateTripPayload,
  SearchTripsParams,
  SegmentSelection,
  Trip,
  TripPosition,
  TripStop,
  TripStopInput,
  UpdateTripStopPayload,
} from '@/types/trips.types';

export const tripsApi = {
  search: (params: SearchTripsParams) =>
    api.get<Paginated<Trip>>('/trips/search', {
      query: params as Record<string, string | number | boolean | undefined>,
    }),

  /** `segment` : tronçon demandé (étape de montée / de descente) — le prix renvoyé est celui de ce tronçon. */
  getOne: (id: string, segment: SegmentSelection = {}) =>
    api.get<Trip>(`/trips/${id}`, {
      query: { boardingStopId: segment.boardingStopId, alightingStopId: segment.alightingStopId },
    }),

  // --- Côté conducteur ---

  listMine: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Trip>>('/trips/mine', { query: params }),

  create: (payload: CreateTripPayload) => api.post<Trip>('/trips', payload),

  publish: (id: string) => api.post<Trip>(`/trips/${id}/publish`),

  cancel: (id: string, payload: CancelTripPayload) => api.post<Trip>(`/trips/${id}/cancel`, payload),

  markDriverArrived: (id: string) => api.post<Trip>(`/trips/${id}/driver-arrived`),

  start: (id: string) => api.post<Trip>(`/trips/${id}/start`),

  markArrived: (id: string) => api.post<Trip>(`/trips/${id}/arrived`),

  complete: (id: string) => api.post<Trip>(`/trips/${id}/complete`),

  findBookings: (id: string) => api.get<Booking[]>(`/trips/${id}/bookings`),

  // --- Étapes (villes traversées) : modifiables tant que le trajet est en brouillon ---

  addStop: (id: string, payload: TripStopInput) => api.post<TripStop>(`/trips/${id}/stops`, payload),

  updateStop: (id: string, stopId: string, payload: UpdateTripStopPayload) =>
    api.patch<TripStop>(`/trips/${id}/stops/${stopId}`, payload),

  removeStop: (id: string, stopId: string) => api.delete<void>(`/trips/${id}/stops/${stopId}`),

  /** Pendant le trajet : prévient les clients qui montent à cette étape. */
  markArrivedAtStop: (id: string, stopId: string) => api.post<TripStop>(`/trips/${id}/stops/${stopId}/arrived`),

  updatePosition: (id: string, latitude: number, longitude: number) =>
    api.patch<TripPosition>(`/trips/${id}/position`, { latitude, longitude }),

  getPosition: (id: string) => api.get<TripPosition | null>(`/trips/${id}/position`),
};
