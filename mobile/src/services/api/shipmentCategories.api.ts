// mobile/src/services/api/shipmentCategories.api.ts
import { api } from './client';
import type { ShipmentCategory } from '@/types/shipments.types';

export const shipmentCategoriesApi = {
  listUsable: (countryId?: string) =>
    api.get<ShipmentCategory[]>('/shipment-categories/usable', { query: { countryId } }),
};
