// mobile/src/services/api/shipments.api.ts
// [21/09/2026] v2 — quote, extend ; liste des envois disponibles typée AvailableShipment.
import { api } from './client';
import type { Paginated } from './types';
import type {
  AssignShipmentPayload,
  AvailableShipment,
  CancelShipmentPayload,
  CreateShipmentPayload,
  ExtendShipmentPayload,
  QuoteShipmentPayload,
  SearchAvailableShipmentsParams,
  Shipment,
  ShipmentQuote,
} from '@/types/shipments.types';

export const shipmentsApi = {
  create: (payload: CreateShipmentPayload) => api.post<Shipment>('/shipments', payload),

  /** Prix affiché avant paiement — calculé par le serveur, identique à celui qui sera facturé. */
  quote: (payload: QuoteShipmentPayload) => api.post<ShipmentQuote>('/shipments/quote', payload),

  /** Prolonge la plage de dates d'un envoi resté sans chauffeur. */
  extend: (id: string, payload: ExtendShipmentPayload) => api.post<Shipment>(`/shipments/${id}/extend`, payload),

  listMine: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Shipment>>('/shipments/mine', { query: params }),

  getOne: (id: string) => api.get<Shipment>(`/shipments/${id}`),

  cancel: (id: string, payload: CancelShipmentPayload) =>
    api.post<Shipment>(`/shipments/${id}/cancel`, payload),

  // --- Côté chauffeur ---

  listAvailable: (params: SearchAvailableShipmentsParams) =>
    api.get<Paginated<AvailableShipment>>('/shipments/available', {
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