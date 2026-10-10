// mobile/src/hooks/useShipmentTracking.ts
// [10/10/2026] v1 — suivi d'un colis, rafraîchi tout seul tant qu'il n'est pas terminé (position, villes traversées).
import { useQuery } from '@tanstack/react-query';
import { trackingApi } from '@/services/api/tracking.api';
import { ApiError } from '@/services/api/ApiError';
import type { ShipmentTracking } from '@/types/tracking.types';

const POLL_INTERVAL_MS = 15_000;

function pollWhileActive(data: ShipmentTracking | undefined): number | false {
  return data && data.outcome === 'ACTIVE' ? POLL_INTERVAL_MS : false;
}

/** Un numéro inconnu (404) ne se retente pas : la réponse sera la même. */
function retryUnlessNotFound(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) return false;
  return failureCount < 2;
}

/** Suivi public par numéro, sans compte. */
export function usePublicTracking(trackingNumber: string | null) {
  return useQuery({
    queryKey: ['tracking', 'public', trackingNumber],
    queryFn: () => trackingApi.getPublic(trackingNumber!),
    enabled: Boolean(trackingNumber),
    refetchInterval: (query) => pollWhileActive(query.state.data),
    retry: retryUnlessNotFound,
  });
}

/** Suivi de l'expéditeur : position exacte. */
export function useMyShipmentTracking(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ['tracking', 'shipment', shipmentId],
    queryFn: () => trackingApi.getForShipment(shipmentId!),
    enabled: Boolean(shipmentId),
    refetchInterval: (query) => pollWhileActive(query.state.data),
    retry: retryUnlessNotFound,
  });
}
