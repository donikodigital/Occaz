// mobile/src/types/shipments.types.ts
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

export interface ShipmentTripSummary {
  id: string;
  departureAt: string;
  driver: { id: string; firstName: string; lastName: string; photoUrl: string | null };
}

export interface Shipment {
  id: string;
  tripId: string | null;
  trip?: ShipmentTripSummary | null;
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
  status: ShipmentStatus;
  price: Money;
  platformFee: Money;
  totalAmount: Money;
  currencyId: string;
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
}

export interface CancelShipmentPayload {
  reason: string;
}
