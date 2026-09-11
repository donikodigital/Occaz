// mobile/src/stores/citySelectionStore.ts
import { create } from 'zustand';
import type { City } from '@/types/geography.types';

/**
 * Chaîne libre plutôt qu'une union figée : select-city.tsx est réutilisé
 * par plusieurs écrans appelants (recherche de trajet — "origin"/
 * "destination", sélection d'adresse d'envoi — "sender"/"recipient"...)
 * qui n'ont pas à partager un même vocabulaire de champs.
 */
export type CityField = string;

interface CitySelectionState {
  /** Champ que l'écran appelant attend — posé avant d'ouvrir le sélecteur. */
  pendingField: CityField | null;
  /** Rempli par select-city.tsx à la sélection ; consommé puis vidé par l'écran appelant. */
  selection: { field: CityField; city: City } | null;
  openFor: (field: CityField) => void;
  select: (city: City) => void;
  consume: () => void;
}

/**
 * Évite le va-et-vient de paramètres de route entre un écran de
 * formulaire et select-city (Expo Router ne renvoie pas de valeur à la
 * fermeture d'un écran) — un petit store en mémoire, jamais persisté,
 * suffit.
 */
export const useCitySelectionStore = create<CitySelectionState>((set, get) => ({
  pendingField: null,
  selection: null,
  openFor: (field) => set({ pendingField: field }),
  select: (city) => {
    const field = get().pendingField;
    if (!field) return;
    set({ selection: { field, city }, pendingField: null });
  },
  consume: () => set({ selection: null }),
}));
