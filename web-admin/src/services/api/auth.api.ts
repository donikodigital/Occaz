// web-admin/src/services/api/auth.api.ts
import { api } from './client';
import type {
  AuthResult,
  LoginPasswordPayload,
  RequestOtpPayload,
  SetupTwoFactorResult,
  VerifyOtpPayload,
} from '@/types/auth.types';

export const authApi = {
  loginWithPassword: (payload: LoginPasswordPayload) =>
    api.post<AuthResult>('/auth/login', payload, { auth: false }),

  requestOtp: (payload: RequestOtpPayload) => api.post<{ expiresInSeconds: number }>('/auth/otp/request', payload, { auth: false }),

  verifyOtp: (payload: VerifyOtpPayload) => api.post<AuthResult>('/auth/otp/verify', payload, { auth: false }),

  logout: () => api.post<void>('/auth/logout'),

  setupTwoFactor: () => api.post<SetupTwoFactorResult>('/auth/2fa/setup'),

  enableTwoFactor: (code: string) => api.post<void>('/auth/2fa/enable', { code }),
};
