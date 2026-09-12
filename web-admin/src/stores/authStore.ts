// web-admin/src/stores/authStore.ts
import { create } from 'zustand';
import { authApi } from '@/services/api/auth.api';
import { usersApi } from '@/services/api/users.api';
import { registerSessionExpiredHandler } from '@/services/api/client';
import { tokenStorage } from '@/services/storage/tokenStorage';
import type { AuthResult, SafeUser } from '@/types/auth.types';

interface AuthState {
  user: SafeUser | null;
  isAuthenticated: boolean;
  /** true pendant la vérification du jeton stocké au chargement — voir Providers.tsx. */
  isHydrating: boolean;
  hydrate: () => Promise<void>;
  setSession: (result: AuthResult) => void;
  logout: () => Promise<void>;
  /** Nettoyage local sans appel réseau — utilisé quand le serveur a déjà invalidé la session. */
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrating: true,

  hydrate: async () => {
    const accessToken = tokenStorage.getAccessToken();
    if (!accessToken) {
      set({ isHydrating: false });
      return;
    }
    try {
      const user = await usersApi.getMe();
      set({ user, isAuthenticated: true, isHydrating: false });
    } catch {
      tokenStorage.clearTokens();
      set({ user: null, isAuthenticated: false, isHydrating: false });
    }
  },

  setSession: (result) => {
    tokenStorage.setTokens(result.accessToken, result.refreshToken);
    set({ user: result.user, isAuthenticated: true, isHydrating: false });
  },

  logout: async () => {
    await authApi.logout().catch(() => undefined);
    tokenStorage.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  clearSession: () => {
    set({ user: null, isAuthenticated: false });
  },
}));

// Enregistré une seule fois au chargement du module — voir client.ts,
// appelé quand un rafraîchissement de jeton échoue réellement.
registerSessionExpiredHandler(() => useAuthStore.getState().clearSession());
