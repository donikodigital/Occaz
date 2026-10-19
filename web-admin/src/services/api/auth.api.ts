// web-admin/src/services/api/auth.api.ts
import { api } from './client';
import type {
  AuthResult,
  LoginPasswordPayload,
  PhoneChangeRequestResult,
  SafeUser,
  RequestStaffCodePayload,
  RequestStaffCodeResult,
  SetupTwoFactorResult,
  VerifyStaffCodePayload,
} from '@/types/auth.types';

export const authApi = {
  loginWithPassword: (payload: LoginPasswordPayload) =>
    api.post<AuthResult>('/auth/login', payload, { auth: false }),

  /** Code de connexion envoyé par e-mail à l'adresse du compte (aucun SMS pour l'équipe). */
  requestStaffCode: (payload: RequestStaffCodePayload) =>
    api.post<RequestStaffCodeResult>('/auth/staff/code/request', payload, { auth: false }),

  verifyStaffCode: (payload: VerifyStaffCodePayload) =>
    api.post<AuthResult>('/auth/staff/code/verify', payload, { auth: false }),

  /** Changement de numéro, étape 1 : un code est envoyé par e-mail à l'adresse du compte (jamais par SMS pour l'équipe). */
  requestPhoneChange: (newPhone: string) => api.post<PhoneChangeRequestResult>('/auth/phone-change/request', { newPhone }),

  /** Changement de numéro, étape 2 : le bon code remplace le numéro du compte. */
  confirmPhoneChange: (newPhone: string, code: string) => api.post<SafeUser>('/auth/phone-change/confirm', { newPhone, code }),

  logout: () => api.post<void>('/auth/logout'),

  setupTwoFactor: () => api.post<SetupTwoFactorResult>('/auth/2fa/setup'),

  enableTwoFactor: (code: string) => api.post<void>('/auth/2fa/enable', { code }),

  requestPasswordReset: (email: string) =>
    api.post<{ message: string }>('/auth/password-reset/request', { email }, { auth: false }),

  confirmPasswordReset: (payload: { email: string; code: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/password-reset/confirm', payload, { auth: false }),
};
