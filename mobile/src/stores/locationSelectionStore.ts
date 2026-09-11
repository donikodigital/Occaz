// mobile/src/stores/locationSelectionStore.ts
import { create } from 'zustand';
import type { TripLocation } from '@/types/trips.types';

/** Chaîne libre — voir la même note dans citySelectionStore.ts. */
export type LocationField = string;

interface LocationSelectionState {
  pendingField: LocationField | null;
  selection: { field: LocationField; location: TripLocation } | null;
  openFor: (field: LocationField) => void;
  select: (location: TripLocation) => void;
  consume: () => void;
}

/** Même principe que citySelectionStore — voir sa note pour le pourquoi. */
export const useLocationSelectionStore = create<LocationSelectionState>((set, get) => ({
  pendingField: null,
  selection: null,
  openFor: (field) => set({ pendingField: field }),
  select: (location) => {
    const field = get().pendingField;
    if (!field) return;
    set({ selection: { field, location }, pendingField: null });
  },
  consume: () => set({ selection: null }),
}));
