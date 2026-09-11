// mobile/src/services/api/auth.api.ts
import { api } from './client';
import type { AuthResult, RequestOtpPayload, VerifyOtpPayload } from '@/types/auth.types';

/** Miroir de AuthController côté backend (Lot 1) — un module par ressource, jamais d'URL en dur ailleurs. */
export const authApi = {
  requestOtp: (payload: RequestOtpPayload) =>
    api.post<{ expiresInSeconds: number }>('/auth/otp/request', payload, { auth: false }),

  verifyOtp: (payload: VerifyOtpPayload) =>
    api.post<AuthResult>('/auth/otp/verify', payload, { auth: false }),

  logout: () => api.post<void>('/auth/logout'),

  logoutAll: () => api.post<void>('/auth/logout-all'),
};
