// mobile/src/hooks/useShipments.ts
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