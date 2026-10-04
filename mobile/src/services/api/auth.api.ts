// mobile/src/services/api/auth.api.ts
import { api } from './client';
import type { AuthResult, RequestOtpPayload, SafeUser, VerifyOtpPayload } from '@/types/auth.types';

/** Miroir de AuthController côté backend (Lot 1) — un module par ressource, jamais d'URL en dur ailleurs. */
export const authApi = {
  requestOtp: (payload: RequestOtpPayload) =>
    api.post<{ expiresInSeconds: number }>('/auth/otp/request', payload, { auth: false }),

  verifyOtp: (payload: VerifyOtpPayload) =>
    api.post<AuthResult>('/auth/otp/verify', payload, { auth: false }),

  /** Changement de numéro, étape 1 : un code est envoyé par SMS au NOUVEAU numéro (compte connecté). */
  requestPhoneChange: (newPhone: string) =>
    api.post<{ expiresInSeconds: number }>('/auth/phone-change/request', { newPhone }),

  /** Étape 2 : le bon code remplace le numéro du compte ; renvoie le compte à jour. */
  confirmPhoneChange: (newPhone: string, code: string) =>
    api.post<SafeUser>('/auth/phone-change/confirm', { newPhone, code }),

  logout: () => api.post<void>('/auth/logout'),

  logoutAll: () => api.post<void>('/auth/logout-all'),
};
