// mobile/src/services/api/trips.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { Booking } from '@/types/bookings.types';
import type { CancelTripPayload, CreateTripPayload, SearchTripsParams, Trip, TripPosition } from '@/types/trips.types';

export const tripsApi = {
  search: (params: SearchTripsParams) =>
    api.get<Paginated<Trip>>('/trips/search', {
      query: params as Record<string, string | number | boolean | undefined>,
    }),

  getOne: (id: string) => api.get<Trip>(`/trips/${id}`),

  // --- Côté chauffeur ---

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

  updatePosition: (id: string, latitude: number, longitude: number) =>
    api.patch<TripPosition>(`/trips/${id}/position`, { latitude, longitude }),

  getPosition: (id: string) => api.get<TripPosition | null>(`/trips/${id}/position`),
};
