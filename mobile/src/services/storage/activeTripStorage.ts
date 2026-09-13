// mobile/src/services/storage/activeTripStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'activeTripLocationTracking';

/**
 * Purement local, aucune donnée sensible — AsyncStorage suffit (voir
 * recentSearches.ts pour la même justification). Sert de pont entre
 * l'écran (qui sait quel trajet est en cours) et la tâche de fond
 * (qui n'a accès à aucun état React et doit retrouver cette
 * information seule, potentiellement après un redémarrage de l'app).
 */
export const activeTripStorage = {
  async get(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEY);
  },
  async set(tripId: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, tripId);
  },
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
};
