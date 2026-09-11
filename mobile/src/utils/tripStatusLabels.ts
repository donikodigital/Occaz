// mobile/src/utils/tripStatusLabels.ts
import type { TripStatus } from '@/types/trips.types';
import type { BookingStatus } from '@/types/bookings.types';
import type { ShipmentStatus } from '@/types/shipments.types';

/** Labels français partagés entre la liste des trajets et le détail d'un trajet (espace chauffeur). */
export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  BOOKING_PENDING: 'Réservation en cours',
  CONFIRMED: 'Confirmé',
  DRIVER_ARRIVED: 'Arrivé au départ',
  PASSENGER_PICKED_UP: 'Passager pris en charge',
  IN_PROGRESS: 'En cours',
  ARRIVED: 'Arrivé à destination',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  DISPUTED: 'En litige',
  REFUNDED: 'Remboursé',
};

export const TRIP_STATUS_TONE: Record<TripStatus, 'primary' | 'success' | 'danger' | 'neutral'> = {
  DRAFT: 'neutral',
  PUBLISHED: 'primary',
  BOOKING_PENDING: 'primary',
  CONFIRMED: 'primary',
  DRIVER_ARRIVED: 'primary',
  PASSENGER_PICKED_UP: 'primary',
  IN_PROGRESS: 'primary',
  ARRIVED: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  DISPUTED: 'danger',
  REFUNDED: 'neutral',
};

export const DRIVER_BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Terminée',
  REFUNDED: 'Remboursée',
  DISPUTED: 'En litige',
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  CREATED: 'En attente de paiement',
  SEARCHING_DRIVER: "Recherche d'un chauffeur",
  DRIVER_ASSIGNED: 'Assigné',
  PICKUP_PENDING: 'Récupération en cours',
  PICKED_UP: 'Colis récupéré',
  IN_TRANSIT: 'En transit',
  DELIVERY_PENDING: 'Livraison en cours',
  DELIVERED: 'Livré',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  DISPUTED: 'En litige',
  REFUNDED: 'Remboursé',
};

export const SHIPMENT_STATUS_TONE: Record<ShipmentStatus, 'primary' | 'success' | 'danger' | 'neutral'> = {
  CREATED: 'neutral',
  SEARCHING_DRIVER: 'primary',
  DRIVER_ASSIGNED: 'primary',
  PICKUP_PENDING: 'primary',
  PICKED_UP: 'primary',
  IN_TRANSIT: 'primary',
  DELIVERY_PENDING: 'primary',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  DISPUTED: 'danger',
  REFUNDED: 'neutral',
};
