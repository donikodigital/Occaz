// mobile/src/hooks/useShipments.ts
// [21/09/2026] v3 — le suivi d'un envoi se rafraîchit tout seul tant qu'il n'est pas terminé.
// [21/09/2026] v2 — useShipmentQuote et useExtendShipment.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shipmentsApi } from '@/services/api/shipments.api';
import type {
  CancelShipmentPayload,
  CreateShipmentPayload,
  ExtendShipmentPayload,
  QuoteShipmentPayload,
} from '@/types/shipments.types';

export function useMyShipments(page = 1) {
  return useQuery({
    queryKey: ['shipments', 'mine', page],
    queryFn: () => shipmentsApi.listMine({ page, limit: 20 }),
  });
}

/** Tant que l'envoi n'est pas terminé, l'écran de suivi se met à jour tout seul : « chauffeur trouvé », colis récupéré, livré… */
const LIVE_STATUSES = ['CREATED', 'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERY_PENDING'];

export function useShipment(id: string | undefined) {
  return useQuery({
    queryKey: ['shipments', id],
    queryFn: () => shipmentsApi.getOne(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && LIVE_STATUSES.includes(status) ? 15_000 : false;
    },
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

/**
 * Devis en direct : `null` tant que le formulaire est incomplet. Le prix
 * vient toujours du serveur — jamais recalculé sur l'appareil.
 */
export function useShipmentQuote(payload: QuoteShipmentPayload | null) {
  return useQuery({
    queryKey: ['shipments', 'quote', payload],
    queryFn: () => shipmentsApi.quote(payload!),
    enabled: payload !== null,
    staleTime: 60_000,
    retry: false,
  });
}

export function useExtendShipment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ExtendShipmentPayload) => shipmentsApi.extend(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['shipments', id] });
    },
  });
}