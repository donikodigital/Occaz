// mobile/src/services/storage/skippedBookingsStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const keyFor = (tripId: string) => `driverTripSkippedBookings:${tripId}`;

/**
 * Clients que le conducteur a décidé de laisser de côté sur un trajet (absents, injoignables) pour continuer le parcours sans
 * eux. Purement local, aucune donnée sensible (identifiants de réservation seulement) : AsyncStorage suffit, comme pour
 * activeTripStorage. Conservé pour que la décision survive à la fermeture de l'application en plein trajet.
 */
export const skippedBookingsStorage = {
  async get(tripId: string): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(keyFor(tripId));
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
    } catch {
      return [];
    }
  },
  async set(tripId: string, bookingIds: string[]): Promise<void> {
    try {
      await AsyncStorage.setItem(keyFor(tripId), JSON.stringify(bookingIds));
    } catch {
      // Sans stockage, la décision reste valable jusqu'à la fermeture de l'écran : pas de quoi bloquer le conducteur.
    }
  },
};
