// web-admin/src/hooks/useShipmentPhotos.ts
// [19/10/2026] v1 — Photos du colis d'un envoi. Les URL signées durent 5 minutes : on les relit un peu avant leur fin.
import { useQuery } from '@tanstack/react-query';
import { shipmentsApi } from '@/services/api/shipments.api';

export function useShipmentPhotos(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ['shipments', 'photos', shipmentId],
    queryFn: () => shipmentsApi.getPhotos(shipmentId!),
    enabled: Boolean(shipmentId),
    staleTime: 3 * 60_000,
    refetchInterval: 4 * 60_000,
    retry: false,
  });
}
