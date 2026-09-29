// web-admin/src/hooks/useTrips.ts
import { useQuery } from '@tanstack/react-query';
import { tripsApi } from '@/services/api/trips.api';

/**
 * Les 100 trajets les plus récents. Rafraîchie toute seule : un trajet en
 * cours change de statut (arrivée, prise en charge, dépose…) sans qu'on
 * ait besoin de recharger la page — même principe que useShipmentsList.
 */
export function useTripsList() {
  return useQuery({
    queryKey: ['trips', 'admin-list'],
    queryFn: () => tripsApi.list({ page: 1, limit: 100 }),
    refetchInterval: 30_000,
  });
}

export function useTripDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['trips', 'admin-detail', id],
    queryFn: () => tripsApi.getDetail(id!),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  });
}

export function useTripBookings(id: string | undefined) {
  return useQuery({
    queryKey: ['trips', 'admin-bookings', id],
    queryFn: () => tripsApi.getBookings(id!),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  });
}