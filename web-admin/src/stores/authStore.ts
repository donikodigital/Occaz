// web-admin/src/stores/authStore.ts
// [02/10/2026] v+ — Les permissions du compte (rôles attribués) sont chargées via GET /users/me : au
// démarrage (hydrate) et juste après une connexion (setSession). Le menu et les actions du back-office
// s'en servent pour n'afficher que ce que le compte a le droit de faire.
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
      const me = await usersApi.getMe();
      // `?? []` : si le serveur (pas encore mis à jour) ne renvoie pas les permissions, on ne bloque pas sur « Chargement… ».
      set({ user: { ...me, permissions: me.permissions ?? [] }, isAuthenticated: true, isHydrating: false });
    } catch {
      tokenStorage.clearTokens();
      set({ user: null, isAuthenticated: false, isHydrating: false });
    }
  },

  setSession: (result) => {
    tokenStorage.setTokens(result.accessToken, result.refreshToken);
    set({ user: result.user, isAuthenticated: true, isHydrating: false });

    // Le résultat de connexion ne contient pas les permissions : on les récupère aussitôt. En cas
    // d'échec on les fixe à vide plutôt que de laisser le back-office attendre indéfiniment.
    usersApi
      .getMe()
      .then((me) => set((state) => (state.isAuthenticated ? { user: { ...me, permissions: me.permissions ?? [] } } : state)))
      .catch(() =>
        set((state) =>
          state.user && state.user.permissions === undefined
            ? { user: { ...state.user, permissions: [] } }
            : state,
        ),
      );
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