// mobile/src/hooks/useShipmentCategories.ts
import { useQuery } from '@tanstack/react-query';
import { shipmentCategoriesApi } from '@/services/api/shipmentCategories.api';

export function useShipmentCategories(countryId?: string) {
  return useQuery({
    queryKey: ['shipment-categories', countryId],
    queryFn: () => shipmentCategoriesApi.listUsable(countryId),
    staleTime: 5 * 60_000,
  });
}
