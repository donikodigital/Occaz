// mobile/src/stores/deviceChallengeStore.ts
// [30/10/2026] v1 — Connexion en attente du code qui confirme un nouveau téléphone.
// Le jeton reste en mémoire (jamais dans l'adresse de l'écran) et disparaît dès que la connexion aboutit ou est abandonnée.
import { create } from 'zustand';
import type { DeviceVerificationRequired } from '@/types/auth.types';
import type { Space } from '@/types/roles.types';

export interface PendingDeviceChallenge extends Omit<DeviceVerificationRequired, 'requiresDeviceVerification'> {
  /** Espace à ouvrir une fois le code validé. */
  space: Space;
  /** Comment la connexion a démarré : l'empreinte garde alors son propre secret, inchangé. */
  origin: 'password' | 'biometric';
}

interface DeviceChallengeState {
  challenge: PendingDeviceChallenge | null;
  start: (result: DeviceVerificationRequired, context: { space: Space; origin: 'password' | 'biometric' }) => void;
  /** Un nouveau code est parti (éventuellement par un autre canal) : le jeton et la destination sont remplacés. */
  update: (result: DeviceVerificationRequired) => void;
  clear: () => void;
}

const fromResult = ({ requiresDeviceVerification: _flag, ...rest }: DeviceVerificationRequired) => rest;

export const useDeviceChallengeStore = create<DeviceChallengeState>((set, get) => ({
  challenge: null,
  start: (result, context) => set({ challenge: { ...fromResult(result), ...context } }),
  update: (result) => {
    const current = get().challenge;
    if (current) set({ challenge: { ...current, ...fromResult(result) } });
  },
  clear: () => set({ challenge: null }),
}));
