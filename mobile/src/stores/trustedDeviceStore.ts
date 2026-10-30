// mobile/src/stores/trustedDeviceStore.ts
// [30/10/2026] v1 — Téléphone de confiance : secret de ce téléphone, question « Enregistrer ce téléphone ? », liste et retrait.
//
// Règles :
//  - Tant que le compte n'a AUCUN téléphone de confiance, la connexion reste libre et la question est posée à chaque connexion (réponse
//    « Pas maintenant » comprise) jusqu'à ce qu'un téléphone soit enregistré.
//  - Dès qu'un téléphone est de confiance, un autre téléphone ne peut se connecter qu'avec un code reçu par e-mail (en priorité) ou par SMS :
//    c'est l'API qui l'impose (voir backend AccountAuthService), l'application ne fait qu'envoyer le secret de ce téléphone s'il en a un.
//  - Se déconnecter ne retire PAS la confiance. Un secret que l'API ne reconnaît plus (téléphone retiré depuis un autre) est effacé ici.
import { Platform } from 'react-native';
import { create } from 'zustand';
import { ApiError } from '@/services/api/ApiError';
import { trustedDeviceApi, TrustedDeviceSummary } from '@/services/api/trustedDevice.api';
import { TrustedDeviceRecord, trustedDeviceStorage } from '@/services/storage/trustedDeviceStorage';
import { useAuthStore } from '@/stores/authStore';
import { translate } from '@/i18n';
import type { DeviceTrustInfo, TrustedDeviceCredential } from '@/types/auth.types';

const platform = (): 'ios' | 'android' | undefined => (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : undefined);
const deviceLabel = (): string | undefined => (Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? translate('Téléphone Android') : undefined);

export type RegisterResult = { ok: true } | { ok: false; message?: string };

interface TrustedDeviceState {
  isLoaded: boolean;
  /** Présent = ce téléphone est un téléphone de confiance. */
  record: TrustedDeviceRecord | null;
  /** La question « Enregistrer ce téléphone ? » doit être posée (affichée par TrustedDevicePromptHost). */
  offerPending: boolean;
  load: () => Promise<void>;
  /** Ce que ce téléphone présente à la connexion pour prouver qu'il est de confiance (rien s'il ne l'est pas). */
  credential: () => TrustedDeviceCredential | undefined;
  /** À appeler après chaque connexion réussie, avec ce que l'API a répondu. */
  noteLogin: (trust: DeviceTrustInfo | undefined) => Promise<void>;
  /** « Oui » : enregistre ce téléphone (compte connecté). */
  register: () => Promise<RegisterResult>;
  /** « Pas maintenant » : la question sera reposée à la prochaine connexion. */
  dismissOffer: () => void;
  list: () => Promise<TrustedDeviceSummary[]>;
  /** Retire un téléphone ; si c'est celui-ci, son secret est effacé aussi. */
  remove: (id: string) => Promise<void>;
  /** Efface seulement l'état local (compte supprimé, secret refusé…). */
  clear: () => Promise<void>;
}

export const useTrustedDeviceStore = create<TrustedDeviceState>((set, get) => ({
  isLoaded: false,
  record: null,
  offerPending: false,

  load: async () => {
    const record = await trustedDeviceStorage.get();
    set({ record, isLoaded: true });
  },

  credential: () => {
    const record = get().record;
    return record ? { id: record.id, secret: record.secret } : undefined;
  },

  noteLogin: async (trust) => {
    if (!trust || Platform.OS === 'web') return;
    // L'API ne reconnaît plus ce téléphone (retiré depuis un autre, ou plafond de 5 atteint) : le secret local ne sert plus à rien.
    if (get().record && !trust.thisDeviceTrusted) await get().clear();
    set({ offerPending: trust.offer && !trust.thisDeviceTrusted });
  },

  register: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return { ok: false };
    try {
      const credential = await trustedDeviceApi.register({ platform: platform(), label: deviceLabel() });
      const record: TrustedDeviceRecord = { id: credential.id, secret: credential.secret, userId: user.id };
      await trustedDeviceStorage.set(record);
      set({ record, offerPending: false });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof ApiError ? error.message : undefined };
    }
  },

  dismissOffer: () => set({ offerPending: false }),

  list: () => trustedDeviceApi.list(),

  remove: async (id) => {
    await trustedDeviceApi.remove(id);
    if (get().record?.id === id) await get().clear();
  },

  clear: async () => {
    await trustedDeviceStorage.clear();
    set({ record: null });
  },
}));

// Un autre compte se connecte sur ce téléphone : la confiance de l'ancien compte ne doit pas rester.
useAuthStore.subscribe((state, previous) => {
  const record = useTrustedDeviceStore.getState().record;
  if (record && state.user && state.user.id !== record.userId && state.user !== previous.user) {
    void useTrustedDeviceStore.getState().clear();
  }
});
