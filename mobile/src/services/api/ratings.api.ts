// mobile/src/services/api/ratings.api.ts
import { api } from './client';
import type { CreateRatingPayload, Rating } from '@/types/ratings.types';

export const ratingsApi = {
  rateBooking: (bookingId: string, payload: CreateRatingPayload) =>
    api.post<Rating>(`/ratings/bookings/${bookingId}`, payload),

  rateShipment: (shipmentId: string, payload: CreateRatingPayload) =>
    api.post<Rating>(`/ratings/shipments/${shipmentId}`, payload),

  findForBooking: (bookingId: string) => api.get<Rating[]>(`/ratings/bookings/${bookingId}`),

  findForShipment: (shipmentId: string) => api.get<Rating[]>(`/ratings/shipments/${shipmentId}`),
};
