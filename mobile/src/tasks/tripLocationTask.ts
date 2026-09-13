// mobile/src/tasks/tripLocationTask.ts
import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';
import { activeTripStorage } from '@/services/storage/activeTripStorage';
import { tripsApi } from '@/services/api/trips.api';

export const TRIP_LOCATION_TASK = 'trip-location-tracking';

/**
 * Défini une seule fois, au chargement du module (jamais dans un
 * composant) — importé tôt dans app/_layout.tsx pour que iOS/Android
 * puisse le retrouver même si l'app a été relancée par le système
 * suite à un événement de localisation, app totalement fermée. La
 * tâche n'a accès à aucun état React : elle relit le trajet actif
 * depuis le stockage local à chaque déclenchement plutôt que de
 * dépendre d'une variable en mémoire qui ne survivrait pas à un
 * redémarrage.
 *
 * Réutilise tripsApi.updatePosition — donc le même client HTTP que le
 * reste de l'app, y compris son rafraîchissement automatique de jeton
 * expiré (voir services/api/client.ts). Aucune erreur ne remonte à une
 * interface : rien à afficher depuis un contexte sans écran.
 */
TaskManager.defineTask(TRIP_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;

  const tripId = await activeTripStorage.get();
  if (!tripId) return;

  const { locations } = (data as { locations: LocationObject[] }) ?? { locations: [] };
  const latest = locations?.[locations.length - 1];
  if (!latest) return;

  try {
    await tripsApi.updatePosition(tripId, latest.coords.latitude, latest.coords.longitude);
  } catch {
    // Silencieux par nature — pas de contexte utilisateur ici, et le
    // prochain déclenchement de la tâche réessaiera de lui-même.
  }
});
