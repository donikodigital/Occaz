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

  // --- Côté conducteur : validation OTP de prise en charge / dépose ---
  // smsSent indique si le SMS est bien parti — le code est de toute
  // façon toujours généré et consultable par le passager dans l'app
  // (voir reveal-for-customer), le SMS n'est qu'un canal best-effort.

  requestPickupOtp: (id: string) =>
    api.post<{ expiresInSeconds: number; smsSent: boolean }>(`/bookings/${id}/otp/pickup/request`),

  verifyPickupOtp: (id: string, code: string) => api.post<void>(`/bookings/${id}/otp/pickup/verify`, { code }),

  requestDropoffOtp: (id: string) =>
    api.post<{ expiresInSeconds: number; smsSent: boolean }>(`/bookings/${id}/otp/dropoff/request`),

  verifyDropoffOtp: (id: string, code: string) => api.post<void>(`/bookings/${id}/otp/dropoff/verify`, { code }),

  // --- Côté client : revoir son propre code dans l'app (renvoie le code en clair, contrairement aux endpoints ci-dessus destinés au conducteur) ---

  revealPickupOtpForCustomer: (id: string) =>
    api.post<{ expiresInSeconds: number; code?: string; smsSent: boolean }>(
      `/bookings/${id}/otp/pickup/reveal-for-customer`,
    ),

  revealDropoffOtpForCustomer: (id: string) =>
    api.post<{ expiresInSeconds: number; code?: string; smsSent: boolean }>(
      `/bookings/${id}/otp/dropoff/reveal-for-customer`,
    ),
};