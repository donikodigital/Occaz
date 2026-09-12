// web-admin/src/services/api/shipments.api.ts
import { api } from './client';
import type { ShipmentContext } from '@/types/shipments.types';

export const shipmentsApi = {
  getOne: (id: string) => api.get<ShipmentContext>(`/shipments/${id}`),
};
