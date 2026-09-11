// backend/src/common/events/domain-events.ts
/**
 * Événements de domaine — découplent les modules Trajets/Envois du
 * module Paiement. Sans ce bus d'événements, TripsModule/ShipmentsModule
 * devraient importer PaymentsModule pour déclencher un remboursement à
 * l'annulation, alors que PaymentsModule importe déjà TripsModule/
 * ShipmentsModule pour confirmer les paiements (confirmPayment) —
 * dépendance circulaire. Avec des événements, chaque module ne connaît
 * que le nom de l'événement, jamais le module qui l'écoute. Sert aussi de
 * point d'accroche pour le Lot 8 (notifications) sans nouvelle
 * dépendance croisée.
 */

export const DOMAIN_EVENTS = {
  BOOKING_CANCELLED: 'booking.cancelled',
  SHIPMENT_CANCELLED: 'shipment.cancelled',
} as const;

export class BookingCancelledEvent {
  constructor(
    public readonly bookingId: string,
    public readonly reason: string,
    /** null si aucune CancellationPolicy n'est configurée pour ce pays/service. */
    public readonly refundEligiblePercentage: number | null,
  ) {}
}

export class ShipmentCancelledEvent {
  constructor(
    public readonly shipmentId: string,
    public readonly reason: string,
    public readonly refundEligiblePercentage: number | null,
  ) {}
}
