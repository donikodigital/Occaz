// mobile/src/hooks/useShipmentOtp.ts
// [30/09/2026] v+ — useRevealShipmentDeliveryOtpForSender : l'expéditeur peut revoir le code de livraison, sur le modèle de useRevealShipmentPickupOtpForSender.
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

/** Pour l'expéditeur : revoir son propre code de récupération dans l'app. */
export function useRevealShipmentPickupOtpForSender(shipmentId: string) {
  return useMutation({ mutationFn: () => shipmentsApi.revealPickupOtpForSender(shipmentId) });
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

/** Pour l'expéditeur : revoir son propre code de livraison dans l'app — le SMS continue de partir sur le téléphone du destinataire. */
export function useRevealShipmentDeliveryOtpForSender(shipmentId: string) {
  return useMutation({ mutationFn: () => shipmentsApi.revealDeliveryOtpForSender(shipmentId) });
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