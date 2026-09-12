// web-admin/src/services/api/shipmentCategories.api.ts
import { api } from './client';
import type { ShipmentCategory, UpsertShipmentCategoryPayload } from '@/types/shipmentCategories.types';

export const shipmentCategoriesApi = {
  listAll: () => api.get<ShipmentCategory[]>('/shipment-categories'),

  getOne: (id: string) => api.get<ShipmentCategory>(`/shipment-categories/${id}`),

  create: (payload: UpsertShipmentCategoryPayload) => api.post<ShipmentCategory>('/shipment-categories', payload),

  update: (id: string, payload: Partial<UpsertShipmentCategoryPayload>) =>
    api.patch<ShipmentCategory>(`/shipment-categories/${id}`, payload),
};
