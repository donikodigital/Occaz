// mobile/src/hooks/useShipmentOtp.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shipmentsApi } from '@/services/api/shipments.api';

/** Toutes les transitions invalident le détail de l'envoi — factorisé comme pour useDriverTrips.ts. */
function useShipmentLifecycleMutation(shipmentId: string, mutationFn: (id: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => mutationFn(shipmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['shipments', 'assigned-to-me'] });
    },
  });
}

export function useMarkShipmentPickupPending(shipmentId: string) {
  return useShipmentLifecycleMutation(shipmentId, shipmentsApi.markPickupPending);
}

export function useMarkShipmentInTransit(shipmentId: string) {
  return useShipmentLifecycleMutation(shipmentId, shipmentsApi.markInTransit);
}

export function useMarkShipmentDeliveryPending(shipmentId: string) {
  return useShipmentLifecycleMutation(shipmentId, shipmentsApi.markDeliveryPending);
}

export function useRequestShipmentPickupOtp(shipmentId: string) {
  return useMutation({ mutationFn: () => shipmentsApi.requestPickupOtp(shipmentId) });
}

export function useVerifyShipmentPickupOtp(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => shipmentsApi.verifyPickupOtp(shipmentId, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['shipments', 'assigned-to-me'] });
    },
  });
}

export function useRequestShipmentDeliveryOtp(shipmentId: string) {
  return useMutation({ mutationFn: () => shipmentsApi.requestDeliveryOtp(shipmentId) });
}

export function useVerifyShipmentDeliveryOtp(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => shipmentsApi.verifyDeliveryOtp(shipmentId, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', shipmentId] });
      queryClient.invalidateQueries({ queryKey: ['shipments', 'assigned-to-me'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}
