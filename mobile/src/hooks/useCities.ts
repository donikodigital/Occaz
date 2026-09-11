// mobile/src/hooks/useCities.ts
import { useQuery } from '@tanstack/react-query';
import { geographyApi } from '@/services/api/geography.api';

export function useCitySearch(search: string, countryId?: string) {
  return useQuery({
    queryKey: ['cities', { search, countryId }],
    queryFn: () => geographyApi.searchCities({ search: search || undefined, countryId, limit: 20 }),
    enabled: search.length >= 2,
  });
}

export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: () => geographyApi.listCountries(),
    staleTime: 5 * 60_000,
  });
}
