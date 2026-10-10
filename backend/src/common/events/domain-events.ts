// backend/src/common/events/domain-events.ts
// [10/10/2026] v4 — SHIPMENT_STATUS_CHANGED et TRIP_STOP_REACHED : suivi des colis (e-mails de statut, passage dans les villes traversées).
// [10/10/2026] v3 — BOOKING_PAID et SHIPMENT_PAID : le paiement vient d'être confirmé (billet et étiquettes envoyés par e-mail).
// [21/09/2026] v2 — événement SHIPMENT_SEARCH_OPENED (un envoi entre en recherche de conducteur).
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
  SHIPMENT_SEARCH_OPENED: 'shipment.search-opened',
  BOOKING_PAID: 'booking.paid',
  SHIPMENT_PAID: 'shipment.paid',
  SHIPMENT_STATUS_CHANGED: 'shipment.status-changed',
  TRIP_STOP_REACHED: 'trip.stop-reached',
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

/**
 * Un envoi vient d'entrer (ou de revenir, après prolongation) en recherche
 * de conducteur : ShipmentDispatchService prévient alors tous les conducteurs
 * éligibles. Événement plutôt qu'appel direct, pour que le paiement (qui
 * déclenche la recherche) n'attende jamais la fin des notifications.
 */
export class ShipmentSearchOpenedEvent {
  constructor(public readonly shipmentId: string) {}
}

/** Le paiement d'une réservation vient d'être confirmé (une seule fois par réservation) : le billet part par e-mail. */
export class BookingPaidEvent {
  constructor(public readonly bookingId: string) {}
}

/** Le paiement d'un envoi vient d'être confirmé (une seule fois par envoi) : les étiquettes de ses colis partent par e-mail. */
export class ShipmentPaidEvent {
  constructor(public readonly shipmentId: string) {}
}

/**
 * Un envoi vient de changer d'étape visible du suivi (conducteur trouvé, colis récupéré, en route, livraison imminente, livré) :
 * TrackingNotificationsService prévient l'expéditeur et le destinataire. Événement plutôt qu'appel direct : le changement de statut
 * n'attend jamais l'envoi des e-mails, et un échec d'envoi ne le défait jamais.
 */
export class ShipmentStatusChangedEvent {
  constructor(
    public readonly shipmentId: string,
    public readonly status: string,
  ) {}
}

/** Le conducteur vient de signaler son arrivée dans une ville traversée : les colis qu'il transporte y « passent ». */
export class TripStopReachedEvent {
  constructor(
    public readonly tripId: string,
    public readonly cityName: string,
  ) {}
}
