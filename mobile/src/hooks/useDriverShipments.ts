// mobile/src/hooks/useDriverShipments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shipmentsApi } from '@/services/api/shipments.api';
import type { AssignShipmentPayload, SearchAvailableShipmentsParams } from '@/types/shipments.types';

export function useAvailableShipments(params: SearchAvailableShipmentsParams) {
  return useQuery({
    queryKey: ['shipments', 'available', params],
    queryFn: () => shipmentsApi.listAvailable(params),
  });
}

export function useAssignedShipments(page = 1) {
  return useQuery({
    queryKey: ['shipments', 'assigned-to-me', page],
    queryFn: () => shipmentsApi.listAssignedToMe({ page, limit: 20 }),
  });
}

export function useAssignShipment(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignShipmentPayload) => shipmentsApi.assign(shipmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', 'available'] });
      queryClient.invalidateQueries({ queryKey: ['shipments', 'assigned-to-me'] });
      queryClient.invalidateQueries({ queryKey: ['shipments', shipmentId] });
    },
  });
}
