// mobile/src/hooks/useTripSearch.ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { tripsApi } from '@/services/api/trips.api';
import type { SearchTripsParams, SegmentSelection } from '@/types/trips.types';

export function useTripSearch(params: SearchTripsParams, enabled: boolean) {
  return useQuery({
    queryKey: ['trips', 'search', params],
    queryFn: () => tripsApi.search(params),
    enabled,
  });
}

/**
 * `segment` : tronçon que le client a choisi dans la recherche (ex. Kindia → Labé) — le prix et l'heure renvoyés sont
 * ceux de ce tronçon. La clé commence par ['trips', id], donc les invalidations existantes continuent de s'appliquer.
 */
export function useTrip(
  id: string | undefined,
  segment: SegmentSelection = {},
  options: { keepPrevious?: boolean } = {},
) {
  return useQuery({
    queryKey: ['trips', id, 'detail', segment.boardingStopId ?? null, segment.alightingStopId ?? null],
    queryFn: () => tripsApi.getOne(id!, segment),
    enabled: Boolean(id),
    // Le client change de ville de montée ou de descente : l'écran garde le tronçon précédent (marqué `isPlaceholderData`)
    // le temps de charger le nouveau, au lieu de repasser par un écran de chargement.
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
  });
}
