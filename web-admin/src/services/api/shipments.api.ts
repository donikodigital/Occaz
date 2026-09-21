// web-admin/src/services/api/shipments.api.ts
// [21/09/2026] v2 — liste et détail admin des envois.
import { api } from './client';
import type { Paginated } from './types';
import type { AdminShipmentDetail, AdminShipmentListItem, ShipmentContext } from '@/types/shipments.types';

export const shipmentsApi = {
  /** Contexte d'un envoi affiché dans un litige. */
  getOne: (id: string) => api.get<ShipmentContext>(`/shipments/${id}`),

  /** Liste de tous les envois (permission shipment.read), du plus récent au plus ancien. */
  list: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<AdminShipmentListItem>>('/shipments', { query: params }),

  getDetail: (id: string) => api.get<AdminShipmentDetail>(`/shipments/${id}`),
};