// mobile/src/services/api/trustedDevice.api.ts
// [30/10/2026] v1 — Miroir de TrustedDeviceController côté backend (téléphones de confiance).
import { api } from './client';
import type { DeviceInfo, DeviceVerificationRequired, TrustedAuthResult, TrustedDeviceCredential } from '@/types/auth.types';

export interface TrustedDeviceSummary {
  id: string;
  platform: string | null;
  label: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export const trustedDeviceApi = {
  /** Enregistre le téléphone de la session en cours. Le secret renvoyé n'est affiché qu'une fois : il va dans le coffre sécurisé. */
  register: (payload: { platform?: 'ios' | 'android'; label?: string }) => api.post<TrustedDeviceCredential>('/auth/trusted-devices', payload),

  list: () => api.get<TrustedDeviceSummary[]>('/auth/trusted-devices'),

  remove: (id: string) => api.delete<void>(`/auth/trusted-devices/${id}`),

  /** Le code reçu confirme ce nouveau téléphone et ouvre la session (route publique : on n'est pas encore connecté). */
  verify: (payload: { challengeToken: string; code: string; device?: DeviceInfo }) =>
    api.post<TrustedAuthResult>('/auth/device-verification/verify', payload, { auth: false }),

  /** Nouveau code, par e-mail ou (si demandé) par SMS. */
  resend: (payload: { challengeToken: string; channel?: 'SMS' }) =>
    api.post<DeviceVerificationRequired>('/auth/device-verification/resend', payload, { auth: false }),
};
