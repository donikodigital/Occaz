// mobile/src/utils/tripStatusLabels.ts
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
import type { TripStatus } from '@/types/trips.types';
import type { BookingStatus } from '@/types/bookings.types';
import type { ShipmentStatus } from '@/types/shipments.types';
import { translate } from '@/i18n';

/** Labels français partagés entre la liste des trajets et le détail d'un trajet (espace conducteur). */
export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  get DRAFT() { return translate('Brouillon'); },
  get PUBLISHED() { return translate('Publié'); },
  get BOOKING_PENDING() { return translate('Réservation en cours'); },
  get CONFIRMED() { return translate('Confirmé'); },
  get DRIVER_ARRIVED() { return translate('Arrivé au départ'); },
  get PASSENGER_PICKED_UP() { return translate('Passager pris en charge'); },
  get IN_PROGRESS() { return translate('En cours'); },
  get ARRIVED() { return translate('Arrivé à destination'); },
  get COMPLETED() { return translate('Terminé'); },
  get CANCELLED() { return translate('Annulé'); },
  get DISPUTED() { return translate('En litige'); },
  get REFUNDED() { return translate('Remboursé'); },
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
  get PENDING_PAYMENT() { return translate('En attente de paiement'); },
  get PAID() { return translate('Payée'); },
  get CONFIRMED() { return translate('Confirmée'); },
  get CANCELLED() { return translate('Annulée'); },
  get COMPLETED() { return translate('Terminée'); },
  get REFUNDED() { return translate('Remboursée'); },
  get DISPUTED() { return translate('En litige'); },
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  get CREATED() { return translate('En attente de paiement'); },
  get SEARCHING_DRIVER() { return translate("Recherche d'un conducteur"); },
  get DRIVER_ASSIGNED() { return translate('Assigné'); },
  get PICKUP_PENDING() { return translate('Récupération en cours'); },
  get PICKED_UP() { return translate('Colis récupéré'); },
  get IN_TRANSIT() { return translate('En transit'); },
  get DELIVERY_PENDING() { return translate('Livraison en cours'); },
  get DELIVERED() { return translate('Livré'); },
  get COMPLETED() { return translate('Terminé'); },
  get CANCELLED() { return translate('Annulé'); },
  get DISPUTED() { return translate('En litige'); },
  get REFUNDED() { return translate('Remboursé'); },
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
