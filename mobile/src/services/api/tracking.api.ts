// mobile/src/services/api/tracking.api.ts
// [10/10/2026] v1 — suivi d'un colis : public (numéro de suivi, sans compte) ou connecté (expéditeur).
import { api } from './client';
import type { ShipmentTracking } from '@/types/tracking.types';

export const trackingApi = {
  /** Sans compte : toute personne qui a le numéro. Position arrondie, aucune donnée personnelle. */
  getPublic: (trackingNumber: string) =>
    api.get<ShipmentTracking>(`/tracking/public/${encodeURIComponent(trackingNumber)}`, { auth: false }),

  /** Expéditeur connecté : même contenu avec la position exacte. */
  getForShipment: (shipmentId: string) => api.get<ShipmentTracking>(`/tracking/shipments/${shipmentId}`),
};
