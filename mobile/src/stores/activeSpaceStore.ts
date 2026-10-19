// mobile/src/stores/activeSpaceStore.ts
// [19/10/2026] v1 — Espace actuellement ouvert (passager ou conducteur) pour un compte qui possède les deux.
// Vide (null) = on suit le type du compte. Il est rempli à la connexion (l'espace choisi sur l'écran d'accueil) et à chaque bascule,
// et vidé à la déconnexion.
import { create } from 'zustand';
import type { Space } from '@/types/roles.types';

interface ActiveSpaceState {
  space: Space | null;
  setSpace: (space: Space | null) => void;
}

export const useActiveSpaceStore = create<ActiveSpaceState>((set) => ({
  space: null,
  setSpace: (space) => set({ space }),
}));
