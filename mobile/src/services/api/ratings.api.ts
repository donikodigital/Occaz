// mobile/src/services/api/ratings.api.ts
// [22/09/2026] v+ — findGiven() pour « Mes avis ».
import { api } from './client';
import type { Paginated } from './types';
import type { CreateRatingPayload, GivenRating, Rating } from '@/types/ratings.types';

export const ratingsApi = {
  /** « Mes avis » — les notations données par l'utilisateur. */
  findGiven: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<GivenRating>>('/ratings/given', { query: params }),

  rateBooking: (bookingId: string, payload: CreateRatingPayload) =>
    api.post<Rating>(`/ratings/bookings/${bookingId}`, payload),

  rateShipment: (shipmentId: string, payload: CreateRatingPayload) =>
    api.post<Rating>(`/ratings/shipments/${shipmentId}`, payload),

  findForBooking: (bookingId: string) => api.get<Rating[]>(`/ratings/bookings/${bookingId}`),

  findForShipment: (shipmentId: string) => api.get<Rating[]>(`/ratings/shipments/${shipmentId}`),
};