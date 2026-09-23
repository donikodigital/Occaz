// mobile/src/types/shipments.types.ts
// [23/09/2026] v3 — champ promoCode facultatif sur CreateShipmentPayload.
// [21/09/2026] v2 — plage de dates, chauffeur direct, devis, AvailableShipment, tripId facultatif à l'acceptation.
import type { Money } from '@/services/api/types';
import type { TripLocation } from './trips.types';

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

export interface ShipmentCategory {
  id: string;
  name: string;
  description: string | null;
  isAllowed: boolean;
  countryId: string | null;
  maxDeclaredValue: Money | null;
  currencyId: string | null;
  priceMultiplier: number;
}

export interface ShipmentItem {
  id: string;
  shipmentId: string;
  label: string;
  weightKg: number | null;
  photoUrl: string | null;
}

export interface ShipmentTrackingEntry {
  id: string;
  shipmentId: string;
  status: ShipmentStatus;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  recordedAt: string;
}

/** Chauffeur tel que l'API l'expose aux parties d'un envoi : jamais ses coordonnées de paiement. */
export interface ShipmentDriverSummary {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  averageRating: number | null;
  ratingsCount: number;
}

export interface ShipmentTripSummary {
  id: string;
  departureAt: string;
  driver: ShipmentDriverSummary;
}

export interface ShipmentCurrency {
  id: string;
  isoCode: string;
  symbol: string | null;
}

export interface Shipment {
  id: string;
  /** Trajet auquel l'envoi est rattaché — nul si le chauffeur n'a pas de trajet établi. */
  tripId: string | null;
  trip?: ShipmentTripSummary | null;
  /** Chauffeur qui a accepté l'envoi (avec ou sans trajet). */
  driverId: string | null;
  driver?: ShipmentDriverSummary | null;
  customerId: string;
  categoryId: string;
  category?: ShipmentCategory;
  senderName: string;
  senderPhone: string;
  senderLocationId: string;
  senderLocation?: TripLocation;
  recipientName: string;
  recipientPhone: string;
  recipientLocationId: string;
  recipientLocation?: TripLocation;
  description: string | null;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  quantity: number;
  declaredValue: Money | null;
  instructions: string | null;
  isUrgent: boolean;
  /** Plage de dates souhaitée par le client. */
  windowStart: string;
  windowEnd: string;
  /** Renseigné quand la plage est terminée sans chauffeur : le client doit prolonger ou être remboursé. */
  extensionRequestedAt: string | null;
  status: ShipmentStatus;
  /** Le client paie un seul montant : `totalAmount` (= `price`). `platformFee` est la commission prélevée sur le gain du chauffeur. */
  price: Money;
  platformFee: Money;
  totalAmount: Money;
  currencyId: string;
  currency?: ShipmentCurrency;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  items?: ShipmentItem[];
  tracking?: ShipmentTrackingEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateShipmentPayload {
  tripId?: string;
  categoryId: string;
  senderName: string;
  senderPhone: string;
  senderLocationId: string;
  recipientName: string;
  recipientPhone: string;
  recipientLocationId: string;
  description?: string;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  quantity?: number;
  declaredValue?: string;
  instructions?: string;
  isUrgent?: boolean;
  /** Plage de dates du départ (ISO) — obligatoire. */
  windowStart: string;
  windowEnd: string;
  /** Code promo à appliquer, s'il y en a un — voir /promo-codes/validate pour l'aperçu avant envoi. */
  promoCode?: string;
}

/** Ce qui entre dans le calcul du prix — sert au devis affiché avant paiement. */
export interface QuoteShipmentPayload {
  categoryId: string;
  senderLocationId: string;
  recipientLocationId: string;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  quantity?: number;
  declaredValue?: string;
  isUrgent?: boolean;
}

export interface ShipmentQuote {
  totalAmount: Money;
  currencyId: string;
  currencyCode: string | null;
  distanceKm: number;
  chargeableWeightKg: number;
  volumetricWeightKg: number | null;
}

export interface ExtendShipmentPayload {
  windowEnd: string;
}

/**
 * Demande d'envoi telle que la voit un chauffeur AVANT d'avoir accepté :
 * sans nom, téléphone ni consigne du client, adresses réduites à leur
 * ville (voir backend/src/shipments/shipment-views.ts).
 */
export interface AvailableShipment {
  id: string;
  status: ShipmentStatus;
  categoryId: string;
  category: { id: string; name: string };
  senderLocation: Pick<TripLocation, 'id' | 'label' | 'cityId'>;
  recipientLocation: Pick<TripLocation, 'id' | 'label' | 'cityId'>;
  weightKg: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  quantity: number;
  declaredValue: Money | null;
  description: string | null;
  isUrgent: boolean;
  windowStart: string;
  windowEnd: string;
  price: Money;
  platformFee: Money;
  totalAmount: Money;
  currencyId: string;
  currencyCode: string;
  createdAt: string;
}

export interface CancelShipmentPayload {
  reason: string;
}

export interface SearchAvailableShipmentsParams {
  originCityId?: string;
  destinationCityId?: string;
  page?: number;
  limit?: number;
}

export interface AssignShipmentPayload {
  /** Facultatif : un chauffeur validé sans trajet établi peut accepter un envoi. */
  tripId?: string;
}