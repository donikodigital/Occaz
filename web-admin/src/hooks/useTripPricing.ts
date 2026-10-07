// web-admin/src/hooks/useTripPricing.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tripPricingApi } from '@/services/api/tripPricing.api';
import type { SaveTripPricingPayload } from '@/types/tripPricing.types';

const KEY = ['trip-pricing-config'];

export function useTripPricingConfig() {
  return useQuery({ queryKey: KEY, queryFn: () => tripPricingApi.getConfig() });
}

export function useSaveTripPricing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveTripPricingPayload) => tripPricingApi.saveConfig(payload),
    onSuccess: (data) => queryClient.setQueryData(KEY, data),
  });
}
