// mobile/src/services/storage/recentSearches.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'recentTripSearches';
const MAX_ENTRIES = 5;

export interface RecentSearch {
  originCityId: string;
  originCityName: string;
  destinationCityId: string;
  destinationCityName: string;
  searchedAt: string;
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
