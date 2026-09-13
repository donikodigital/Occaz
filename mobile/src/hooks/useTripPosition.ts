// mobile/src/hooks/useTripPosition.ts
import { useQuery } from '@tanstack/react-query';
import { tripsApi } from '@/services/api/trips.api';

const POLL_INTERVAL_MS = 10_000;

/** Polling REST plutôt qu'un canal temps réel — voir la note de useTripPositionBroadcast.ts côté chauffeur. */
export function useTripPosition(tripId: string, isActive: boolean) {
  return useQuery({
    queryKey: ['trips', tripId, 'position'],
    queryFn: () => tripsApi.getPosition(tripId),
    enabled: isActive,
    refetchInterval: isActive ? POLL_INTERVAL_MS : false,
  });
}
