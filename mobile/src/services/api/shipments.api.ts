// mobile/src/services/api/shipments.api.ts
// [30/09/2026] v3 — revealDeliveryOtpForSender : l'expéditeur peut revoir le code de livraison dans l'app.
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

  // smsSent indique si le SMS est bien parti — le code est de toute
  // façon toujours généré et consultable (par l'expéditeur, côté
  // récupération comme côté livraison) dans l'app, le SMS n'est qu'un
  // canal best-effort.

  requestPickupOtp: (id: string) =>
    api.post<{ expiresInSeconds: number; smsSent: boolean }>(`/shipments/${id}/otp/pickup/request`),

  /** Pour l'expéditeur : revoir son propre code dans l'app (renvoie le code en clair, contrairement à requestPickupOtp destiné au chauffeur). */
  revealPickupOtpForSender: (id: string) =>
    api.post<{ expiresInSeconds: number; code?: string; smsSent: boolean }>(
      `/shipments/${id}/otp/pickup/reveal-for-sender`,
    ),

  verifyPickupOtp: (id: string, code: string) =>
    api.post<Shipment>(`/shipments/${id}/otp/pickup/verify`, { code }),

  markInTransit: (id: string) => api.post<Shipment>(`/shipments/${id}/in-transit`),

  markDeliveryPending: (id: string) => api.post<Shipment>(`/shipments/${id}/delivery-pending`),

  // Le SMS de ce code part sur le téléphone du DESTINATAIRE, qui n'a pas
  // de compte dans l'app — c'est lui qui doit le communiquer au chauffeur
  // à la livraison. revealDeliveryOtpForSender ci-dessous permet
  // seulement à l'expéditeur de le retrouver dans son propre espace
  // (utile si le SMS n'est pas arrivé au destinataire, ou pour le lui
  // retransmettre autrement).

  requestDeliveryOtp: (id: string) =>
    api.post<{ expiresInSeconds: number; smsSent: boolean }>(`/shipments/${id}/otp/delivery/request`),

  /** Pour l'expéditeur : revoir le code de livraison dans l'app (renvoie le code en clair). Le SMS continue de partir sur le téléphone du destinataire. */
  revealDeliveryOtpForSender: (id: string) =>
    api.post<{ expiresInSeconds: number; code?: string; smsSent: boolean }>(
      `/shipments/${id}/otp/delivery/reveal-for-sender`,
    ),

  verifyDeliveryOtp: (id: string, code: string) =>
    api.post<Shipment>(`/shipments/${id}/otp/delivery/verify`, { code }),
};