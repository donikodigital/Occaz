// mobile/src/hooks/useTripPositionBroadcast.ts
//
// [09/10/2026] v2 — Sur le web, `Location.startLocationUpdatesAsync` n'existe pas (pas de service d'arrière-plan dans un
// navigateur) : l'écran du trajet plantait avec « startLocationUpdatesAsync is not a function » dès que le trajet passait en
// cours. Le web (et tout appareil où le démarrage d'arrière-plan échoue, ex. Expo Go) utilise désormais directement le repli
// premier plan, qui passe par la géolocalisation du navigateur / getCurrentPositionAsync.
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { activeTripStorage } from '@/services/storage/activeTripStorage';
import { tripsApi } from '@/services/api/trips.api';
import { TRIP_LOCATION_TASK } from '@/tasks/tripLocationTask';
import { OCEAN } from '@/theme/ocean';

const FOREGROUND_INTERVAL_MS = 10_000;

type Mode = 'idle' | 'background' | 'foreground';

/**
 * Deux façons de partager la position, du meilleur au moins bon :
 *
 * 1. **Arrière-plan** (`mode: 'background'`) — continue même app
 *    fermée/minimisée. Nécessite la permission "Toujours", demandée ici
 *    de façon contextuelle (seulement quand un trajet démarre
 *    réellement, jamais au premier lancement) — c'est ce qu'Apple exige
 *    pour ne pas rejeter l'app en revue. Utilise
 *    `expo-task-manager` + `expo-location` (voir tasks/tripLocationTask.ts),
 *    avec une notification persistante côté Android (obligatoire dès
 *    qu'un service tourne en fond).
 * 2. **Premier plan uniquement** (`mode: 'foreground'`) — repli
 *    automatique si la permission "Toujours" est refusée. S'arrête dès
 *    que l'app est minimisée ; mieux que rien plutôt que de bloquer le
 *    conducteur qui refuse "Toujours".
 */
export function useTripPositionBroadcast(tripId: string, isActive: boolean) {
  const [mode, setMode] = useState<Mode>('idle');
  const [error, setError] = useState<string | undefined>();
  const foregroundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Démarrage/arrêt du mode arrière-plan (ou repli premier plan si refusé).
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;

    async function start() {
      const foreground = await Location.requestForegroundPermissionsAsync();
      if (!foreground.granted) {
        if (!cancelled) setError('Autorisez la localisation pour partager votre position avec le passager.');
        return;
      }

      // Pas d'arrière-plan dans un navigateur : repli premier plan direct, sans demander la permission « Toujours ».
      if (Platform.OS === 'web') {
        if (!cancelled) setMode('foreground');
        return;
      }

      const background = await Location.requestBackgroundPermissionsAsync().catch(() => null);
      if (background?.granted) {
        try {
          await activeTripStorage.set(tripId);
          const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK).catch(() => false);
          if (!alreadyStarted) {
            await Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK, {
              accuracy: Location.Accuracy.High,
              timeInterval: FOREGROUND_INTERVAL_MS,
              distanceInterval: 25,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: 'Trajet en cours',
                notificationBody: 'Votre position est partagée avec le passager.',
                notificationColor: OCEAN.base,
              },
            });
          }
          if (!cancelled) {
            setMode('background');
            setError(undefined);
          }
          return;
        } catch {
          // Démarrage d'arrière-plan impossible sur cet appareil : on retombe sur le premier plan ci-dessous.
        }
      }

      // "Toujours" refusé — on continue quand même, en repli premier plan,
      // plutôt que de bloquer le conducteur qui ne veut pas de ce niveau
      // d'accès. Le passager verra juste des mises à jour qui s'arrêtent
      // si le conducteur minimise l'app.
      if (!cancelled) setMode('foreground');
    }

    start();

    return () => {
      cancelled = true;
    };
  }, [tripId, isActive]);

  // Arrêt propre dès que le trajet cesse d'être actif (peu importe le mode en cours).
  useEffect(() => {
    if (isActive) return;
    (async () => {
      const started = await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK).catch(() => false);
      if (started) await Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK).catch(() => undefined);
      await activeTripStorage.clear();
    })();
    setMode('idle');
  }, [isActive]);

  // Repli premier plan : un setInterval classique, seulement si le mode arrière-plan n'a pas pu démarrer.
  useEffect(() => {
    if (mode !== 'foreground' || !isActive) return;
    let cancelled = false;

    async function sendOnce() {
      try {
        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        await tripsApi.updatePosition(tripId, position.coords.latitude, position.coords.longitude);
        setError(undefined);
      } catch {
        if (!cancelled) setError('Impossible de partager votre position pour le moment.');
      }
    }

    sendOnce();
    foregroundIntervalRef.current = setInterval(sendOnce, FOREGROUND_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (foregroundIntervalRef.current) clearInterval(foregroundIntervalRef.current);
    };
  }, [mode, isActive, tripId]);

  return { error, mode };
}