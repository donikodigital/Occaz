// web-admin/src/types/shipments.types.ts
// [21/09/2026] v2 — chauffeur direct (avec ou sans trajet), types de la liste et du détail admin des envois.
import type { Money } from '@/services/api/types';

export type ShipmentStatus =
  | 'CREATED'
  | 'SEARCHING_DRIVER'
  | 'DRIVER_ASSIGNED'
  | 'PICKUP_PENDING'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'DELIVERY_PENDING'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'REFUNDED';

/** Chauffeur tel que l'API l'expose : jamais ses coordonnées de paiement. */
export interface ShipmentDriverSummary {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  averageRating: number | null;
  ratingsCount: number;
}

/** Contexte affiché dans un litige. Le chauffeur d'un envoi est `driver` (avec ou sans trajet) ; `trip.driver` ne sert que de repli. */
export interface ShipmentContext {
  id: string;
  customerId: string;
  senderName: string;
  recipientName: string;
  totalAmount: Money;
  currencyId: string;
  status: string;
  category?: { name: string };
  driver?: ShipmentDriverSummary | null;
  trip?: { id: string; driver?: { firstName: string; lastName: string } } | null;
}

export interface ShipmentPlace {
  id: string;
  label: string;
  city?: { id: string; name: string } | null;
}

/** Une ligne de la liste admin (GET /shipments). */
export interface AdminShipmentListItem {
  id: string;
  status: ShipmentStatus;
  senderName: string;
  recipientName: string;
  senderLocation?: ShipmentPlace;
  recipientLocation?: ShipmentPlace;
  category?: { name: string } | null;
  currency?: { isoCode: string } | null;
  weightKg: number;
  isUrgent: boolean;
  /** Plage de dates souhaitée par le client. */
  windowStart: string;
  windowEnd: string;
  /** Renseigné quand la plage est terminée sans chauffeur : le client doit prolonger ou être remboursé. */
  extensionRequestedAt: string | null;
  /** Ce que le client a payé (un seul montant). */
  totalAmount: Money;
  /** Commission de la plateforme, prélevée sur le gain du chauffeur. */
  platformFee: Money;
  driver?: ShipmentDriverSummary | null;
  createdAt: string;
}

export interface ShipmentTrackingEntry {
  id: string;
  status: ShipmentStatus;
  note: string | null;
  recordedAt: string;
}

/** Détail admin d'un envoi (GET /shipments/:id). */
export interface AdminShipmentDetail extends AdminShipmentListItem {
  senderPhone: string;
  recipientPhone: string;
  description: string | null;
  instructions: string | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  quantity: number;
  declaredValue: Money | null;
  tripId: string | null;
  driverId: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  tracking?: ShipmentTrackingEntry[];
}