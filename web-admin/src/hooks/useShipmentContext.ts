// web-admin/src/hooks/useShipmentContext.ts
import { useQuery } from '@tanstack/react-query';
import { shipmentsApi } from '@/services/api/shipments.api';

export function useShipmentContext(id: string | undefined) {
  return useQuery({
    queryKey: ['shipments', id],
    queryFn: () => shipmentsApi.getOne(id!),
    enabled: Boolean(id),
  });
}
