// mobile/src/services/storage/recentSearches.ts
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate } from '@/i18n';

const STORAGE_KEY = 'recentTripSearches';
const MAX_ENTRIES = 5;

/** Une recherche peut ne préciser qu'une ville (ex. seulement la destination) : l'autre champ est alors absent. */
export interface RecentSearch {
  originCityId?: string;
  originCityName?: string;
  destinationCityId?: string;
  destinationCityName?: string;
  searchedAt: string;
}

/** « Kindia → Labé », ou « Toutes les villes → Labé » quand le départ n'est pas précisé. */
export function formatRecentSearch(search: Pick<RecentSearch, 'originCityName' | 'destinationCityName'>): string {
  return `${search.originCityName ?? translate('Toutes les villes')} → ${search.destinationCityName ?? translate('Toutes les villes')}`;
}

/**
 * Purement local — aucune donnée sensible, AsyncStorage suffit (pas
 * besoin d'expo-secure-store, réservé aux jetons d'authentification).
 */
export const recentSearchesStorage = {
  async getAll(): Promise<RecentSearch[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as RecentSearch[];
    } catch {
      return [];
    }
  },

  async add(entry: RecentSearch): Promise<void> {
    const existing = await recentSearchesStorage.getAll();
    const deduped = existing.filter(
      (item) =>
        !(item.originCityId === entry.originCityId && item.destinationCityId === entry.destinationCityId),
    );
    const updated = [entry, ...deduped].slice(0, MAX_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },
};
