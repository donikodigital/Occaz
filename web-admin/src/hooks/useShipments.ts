// web-admin/src/hooks/useShipments.ts
import { useQuery } from '@tanstack/react-query';
import { shipmentsApi } from '@/services/api/shipments.api';

/**
 * Les 100 envois les plus récents. Rafraîchie toute seule : c'est un écran de
 * suivi, on veut voir apparaître les acceptations et les fins de période
 * sans recharger la page.
 */
export function useShipmentsList() {
  return useQuery({
    queryKey: ['shipments', 'admin-list'],
    queryFn: () => shipmentsApi.list({ page: 1, limit: 100 }),
    refetchInterval: 30_000,
  });
}

export function useShipmentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['shipments', 'admin-detail', id],
    queryFn: () => shipmentsApi.getDetail(id!),
    enabled: Boolean(id),
    refetchInterval: 30_000,
  });
}