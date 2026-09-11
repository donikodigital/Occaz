// mobile/src/services/api/bookings.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { Booking, CancelBookingPayload, CreateBookingPayload } from '@/types/bookings.types';

export const bookingsApi = {
  create: (payload: CreateBookingPayload) => api.post<Booking>('/bookings', payload),

  listMine: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Booking>>('/bookings/mine', { query: params }),

  getOne: (id: string) => api.get<Booking>(`/bookings/${id}`),

  cancel: (id: string, payload: CancelBookingPayload) =>
    api.post<Booking & { refundEligiblePercentage: number | null }>(`/bookings/${id}/cancel`, payload),
};
