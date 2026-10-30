// mobile/src/services/api/biometric.api.ts
// [30/10/2026] v1 — Miroir de BiometricAuthController côté backend (connexion rapide par empreinte).
import { api } from './client';
import type { BiometricLoginResult, DeviceInfo, DeviceVerificationRequired, TrustedDeviceCredential } from '@/types/auth.types';

export interface BiometricEnrollment {
  credentialId: string;
  /** Secret à ranger dans le coffre sécurisé du téléphone (affiché une seule fois). */
  token: string;
}

export interface BiometricDevice {
  id: string;
  platform: string | null;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export const biometricApi = {
  /** Active l'empreinte sur ce téléphone : le mot de passe est redemandé. */
  enable: (payload: { password: string; platform?: 'ios' | 'android'; label?: string }) =>
    api.post<BiometricEnrollment>('/auth/biometric/enable', payload),

  /** Connexion avec le secret libéré par l'empreinte (route publique). Renvoie aussi le nouveau secret. */
  login: (payload: { credentialId: string; token: string; device?: DeviceInfo; trustedDevice?: TrustedDeviceCredential }) =>
    api.post<BiometricLoginResult | DeviceVerificationRequired>('/auth/biometric/login', payload, { auth: false }),

  disable: (credentialId: string) => api.post<void>('/auth/biometric/disable', { credentialId }),

  /** Téléphones sur lesquels l'empreinte est active. */
  list: () => api.get<BiometricDevice[]>('/auth/biometric'),
};
