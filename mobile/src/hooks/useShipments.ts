// mobile/src/hooks/useShipments.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shipmentsApi } from '@/services/api/shipments.api';
import type { CancelShipmentPayload, CreateShipmentPayload } from '@/types/shipments.types';

export function useMyShipments(page = 1) {
  return useQuery({
    queryKey: ['shipments', 'mine', page],
    queryFn: () => shipmentsApi.listMine({ page, limit: 20 }),
  });
}

export function useShipment(id: string | undefined) {
  return useQuery({
    queryKey: ['shipments', id],
    queryFn: () => shipmentsApi.getOne(id!),
    enabled: Boolean(id),
  });
}

export function useCreateShipment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateShipmentPayload) => shipmentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', 'mine'] });
    },
  });
}

export function useCancelShipment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CancelShipmentPayload) => shipmentsApi.cancel(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['shipments', id] });
    },
  });
}
