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

  // smsSent indique si le SMS est bien parti — le code est de toute
  // façon toujours généré et consultable (par l'expéditeur, côté
  // récupération) dans l'app, le SMS n'est qu'un canal best-effort.

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

  // Le destinataire n'a pas de compte dans l'app (contrairement à
  // l'expéditeur) : il n'existe pas de reveal-for-recipient, ce code
  // dépend donc entièrement de ce SMS — voir le message à l'utilisateur
  // à ce sujet.
  requestDeliveryOtp: (id: string) =>
    api.post<{ expiresInSeconds: number; smsSent: boolean }>(`/shipments/${id}/otp/delivery/request`),

  verifyDeliveryOtp: (id: string, code: string) =>
    api.post<Shipment>(`/shipments/${id}/otp/delivery/verify`, { code }),
};