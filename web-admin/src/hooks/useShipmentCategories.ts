// web-admin/src/hooks/useShipmentCategories.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shipmentCategoriesApi } from '@/services/api/shipmentCategories.api';
import type { UpsertShipmentCategoryPayload } from '@/types/shipmentCategories.types';

export function useShipmentCategories() {
  return useQuery({
    queryKey: ['shipment-categories'],
    queryFn: () => shipmentCategoriesApi.listAll(),
  });
}

export function useShipmentCategory(id: string | undefined) {
  return useQuery({
    queryKey: ['shipment-categories', id],
    queryFn: () => shipmentCategoriesApi.getOne(id!),
    enabled: Boolean(id),
  });
}

export function useCreateShipmentCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertShipmentCategoryPayload) => shipmentCategoriesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipment-categories'] }),
  });
}

export function useUpdateShipmentCategory(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<UpsertShipmentCategoryPayload>) => shipmentCategoriesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipment-categories'] });
      queryClient.invalidateQueries({ queryKey: ['shipment-categories', id] });
    },
  });
}
