// mobile/src/hooks/useCurrencies.ts
import { useQuery } from '@tanstack/react-query';
import { currenciesApi } from '@/services/api/currencies.api';

export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: () => currenciesApi.listAll(),
    staleTime: 10 * 60_000,
  });
}
