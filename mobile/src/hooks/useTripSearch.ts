// mobile/src/hooks/useTripSearch.ts
import { useQuery } from '@tanstack/react-query';
import { tripsApi } from '@/services/api/trips.api';
import type { SearchTripsParams } from '@/types/trips.types';

export function useTripSearch(params: SearchTripsParams, enabled: boolean) {
  return useQuery({
    queryKey: ['trips', 'search', params],
    queryFn: () => tripsApi.search(params),
    enabled,
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: ['trips', id],
    queryFn: () => tripsApi.getOne(id!),
    enabled: Boolean(id),
  });
}
