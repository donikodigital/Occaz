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

  // --- Côté chauffeur : validation OTP de prise en charge / dépose ---

  requestPickupOtp: (id: string) => api.post<{ expiresInSeconds: number }>(`/bookings/${id}/otp/pickup/request`),

  verifyPickupOtp: (id: string, code: string) => api.post<void>(`/bookings/${id}/otp/pickup/verify`, { code }),

  requestDropoffOtp: (id: string) => api.post<{ expiresInSeconds: number }>(`/bookings/${id}/otp/dropoff/request`),

  verifyDropoffOtp: (id: string, code: string) => api.post<void>(`/bookings/${id}/otp/dropoff/verify`, { code }),
};
