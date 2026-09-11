// mobile/src/services/api/shipments.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { CancelShipmentPayload, CreateShipmentPayload, Shipment } from '@/types/shipments.types';

export const shipmentsApi = {
  create: (payload: CreateShipmentPayload) => api.post<Shipment>('/shipments', payload),

  listMine: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Shipment>>('/shipments/mine', { query: params }),

  getOne: (id: string) => api.get<Shipment>(`/shipments/${id}`),

  cancel: (id: string, payload: CancelShipmentPayload) =>
    api.post<Shipment>(`/shipments/${id}/cancel`, payload),
};
