// mobile/src/services/api/shipments.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type {
  AssignShipmentPayload,
  CancelShipmentPayload,
  CreateShipmentPayload,
  SearchAvailableShipmentsParams,
  Shipment,
} from '@/types/shipments.types';

export const shipmentsApi = {
  create: (payload: CreateShipmentPayload) => api.post<Shipment>('/shipments', payload),

  listMine: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Shipment>>('/shipments/mine', { query: params }),

  getOne: (id: string) => api.get<Shipment>(`/shipments/${id}`),

  cancel: (id: string, payload: CancelShipmentPayload) =>
    api.post<Shipment>(`/shipments/${id}/cancel`, payload),

  // --- Côté chauffeur ---

  listAvailable: (params: SearchAvailableShipmentsParams) =>
    api.get<Paginated<Shipment>>('/shipments/available', {
      query: params as Record<string, string | number | boolean | undefined>,
    }),

  listAssignedToMe: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Shipment>>('/shipments/assigned-to-me', { query: params }),

  assign: (id: string, payload: AssignShipmentPayload) =>
    api.post<Shipment>(`/shipments/${id}/assign`, payload),

  markPickupPending: (id: string) => api.post<Shipment>(`/shipments/${id}/pickup-pending`),

  requestPickupOtp: (id: string) => api.post<{ expiresInSeconds: number }>(`/shipments/${id}/otp/pickup/request`),

  verifyPickupOtp: (id: string, code: string) =>
    api.post<Shipment>(`/shipments/${id}/otp/pickup/verify`, { code }),

  markInTransit: (id: string) => api.post<Shipment>(`/shipments/${id}/in-transit`),

  markDeliveryPending: (id: string) => api.post<Shipment>(`/shipments/${id}/delivery-pending`),

  requestDeliveryOtp: (id: string) =>
    api.post<{ expiresInSeconds: number }>(`/shipments/${id}/otp/delivery/request`),

  verifyDeliveryOtp: (id: string, code: string) =>
    api.post<Shipment>(`/shipments/${id}/otp/delivery/verify`, { code }),
};
