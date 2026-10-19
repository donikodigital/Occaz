// mobile/src/stores/connectivityStore.ts
// [19/10/2026] v1 — État du réseau, sans dépendance native : le client API le met à jour à chaque requête (échec réseau => hors connexion,
// toute réponse du serveur => en ligne), et une vérification régulière (useConnectivityProbe) détecte le retour du réseau.
import { create } from 'zustand';

interface ConnectivityState {
  /** true tant que la dernière requête a échoué faute de réseau. */
  offline: boolean;
  markOffline: () => void;
  markOnline: () => void;
}

export const useConnectivityStore = create<ConnectivityState>((set, get) => ({
  offline: false,
  // Évite de redéclencher un rendu à chaque requête réussie quand l'état ne change pas.
  markOffline: () => {
    if (!get().offline) set({ offline: true });
  },
  markOnline: () => {
    if (get().offline) set({ offline: false });
  },
}));
