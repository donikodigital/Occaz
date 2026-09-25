// mobile/src/hooks/useTripPosition.ts
import { useQuery } from '@tanstack/react-query';
import { tripsApi } from '@/services/api/trips.api';

const POLL_INTERVAL_MS = 10_000;

/**
 * Côté client : interroge périodiquement la dernière position connue du
 * chauffeur (GET /trips/:id/position), plutôt que de lire le GPS de cet
 * appareil — c'est `useTripPositionBroadcast` (côté chauffeur) qui envoie
 * cette position, celui-ci ne fait que la relire. Ne sonde que pendant un
 * trajet réellement en cours.
 */
export function useTripPosition(tripId: string, isActive: boolean) {
  return useQuery({
    queryKey: ['trips', tripId, 'position'],
    queryFn: () => tripsApi.getPosition(tripId),
    enabled: isActive && Boolean(tripId),
    refetchInterval: isActive ? POLL_INTERVAL_MS : false,
  });
}