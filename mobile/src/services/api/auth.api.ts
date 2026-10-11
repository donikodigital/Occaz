// mobile/src/services/api/auth.api.ts
import { api } from './client';
import type {
  AuthResult,
  LoginPhonePayload,
  PasswordResetChannel,
  PasswordResetRequestResult,
  RequestOtpPayload,
  SafeUser,
  SignupPhonePayload,
  VerifyOtpPayload,
} from '@/types/auth.types';

/** Miroir de AuthController côté backend (Lot 1) — un module par ressource, jamais d'URL en dur ailleurs. */
export const authApi = {
  requestOtp: (payload: RequestOtpPayload) =>
    api.post<{ expiresInSeconds: number }>('/auth/otp/request', payload, { auth: false }),

  verifyOtp: (payload: VerifyOtpPayload) =>
    api.post<AuthResult>('/auth/otp/verify', payload, { auth: false }),

  // --- Inscription en étapes, connexion par mot de passe, mot de passe oublié (clients et conducteurs) ---

  /** Inscription, étape du téléphone : un code SMS part immédiatement vers ce numéro. */
  signupPhone: (payload: SignupPhonePayload) =>
    api.post<{ expiresInSeconds: number }>('/auth/signup/phone', payload, { auth: false }),

  /** Le bon code prouve le numéro et ouvre la session ; l'inscription se termine ensuite (e-mail facultatif, mot de passe). */
  verifySignupPhone: (payload: VerifyOtpPayload) =>
    api.post<AuthResult>('/auth/signup/phone/verify', payload, { auth: false }),

  /** E-mail facultatif : un code part à cette adresse (compte connecté). */
  requestEmailCode: (email: string) => api.post<{ expiresInSeconds: number }>('/auth/email/request', { email }),

  verifyEmailCode: (email: string, code: string) => api.post<SafeUser>('/auth/email/verify', { email, code }),

  /** Première définition du mot de passe à 6 chiffres. */
  setPassword: (password: string) => api.post<SafeUser>('/auth/password/set', { password }),

  /** Changer son mot de passe depuis le profil : il faut connaître l'actuel ; les autres appareils sont déconnectés. */
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/password/change', { currentPassword, newPassword }),

  loginWithPhone: (payload: LoginPhonePayload) => api.post<AuthResult>('/auth/login/phone', payload, { auth: false }),

  requestPasswordReset: (phone: string, channel: PasswordResetChannel) =>
    api.post<PasswordResetRequestResult>('/auth/forgot-password/request', { phone, channel }, { auth: false }),

  verifyPasswordReset: (phone: string, code: string) =>
    api.post<{ resetToken: string }>('/auth/forgot-password/verify', { phone, code }, { auth: false }),

  resetPassword: (resetToken: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/forgot-password/reset', { resetToken, newPassword }, { auth: false }),

  /** Changement de numéro, étape 1 : un code est envoyé par SMS au NOUVEAU numéro (compte connecté). */
  requestPhoneChange: (newPhone: string) =>
    api.post<{ expiresInSeconds: number }>('/auth/phone-change/request', { newPhone }),

  /** Étape 2 : le bon code remplace le numéro du compte ; renvoie le compte à jour. */
  confirmPhoneChange: (newPhone: string, code: string) =>
    api.post<SafeUser>('/auth/phone-change/confirm', { newPhone, code }),

  logout: () => api.post<void>('/auth/logout'),

  logoutAll: () => api.post<void>('/auth/logout-all'),
};
