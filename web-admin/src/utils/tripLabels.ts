// web-admin/src/utils/tripLabels.ts
// Libellés, couleurs, regroupements et formats de date des trajets — même
// esprit que shipmentLabels.ts.
import type { AdminTripListItem, TripStatus } from '@/types/trips.types';

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  BOOKING_PENDING: 'Réservation en attente',
  CONFIRMED: 'Confirmé',
  DRIVER_ARRIVED: 'Conducteur arrivé',
  PASSENGER_PICKED_UP: 'Passagers pris en charge',
  IN_PROGRESS: 'En cours',
  ARRIVED: 'Arrivé à destination',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  DISPUTED: 'En litige',
  REFUNDED: 'Remboursé',
};

export type TripTone = 'primary' | 'neutral' | 'success' | 'accent' | 'danger';

export const TRIP_STATUS_TONE: Record<TripStatus, TripTone> = {
  DRAFT: 'neutral',
  PUBLISHED: 'accent',
  BOOKING_PENDING: 'accent',
  CONFIRMED: 'primary',
  DRIVER_ARRIVED: 'primary',
  PASSENGER_PICKED_UP: 'primary',
  IN_PROGRESS: 'primary',
  ARRIVED: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  DISPUTED: 'danger',
  REFUNDED: 'neutral',
};

/** Regroupements pour filtrer la liste : ce que l'équipe veut vraiment voir d'un coup d'œil. */
export type TripGroup = 'draft' | 'searching' | 'active' | 'done' | 'disputed' | 'closed';

export const TRIP_GROUP_OPTIONS: { value: TripGroup; label: string }[] = [
  { value: 'searching', label: 'Recherche de passagers' },
  { value: 'active', label: 'En cours' },
  { value: 'done', label: 'Terminés' },
  { value: 'disputed', label: 'En litige' },
  { value: 'closed', label: 'Annulés' },
  { value: 'draft', label: 'Brouillons' },
];

export function groupOf(trip: Pick<AdminTripListItem, 'status'>): TripGroup {
  switch (trip.status) {
    case 'DRAFT':
      return 'draft';
    case 'PUBLISHED':
    case 'BOOKING_PENDING':
      return 'searching';
    case 'COMPLETED':
      return 'done';
    case 'DISPUTED':
      return 'disputed';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'closed';
    default:
      return 'active';
  }
}

const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const DATE_TIME = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function formatShortDate(iso: string): string {
  return SHORT_DATE.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/** « Conakry → Labé » — toujours renseigné, la ville est un champ obligatoire du trajet. */
export function routeLabel(trip: Pick<AdminTripListItem, 'originCity' | 'destinationCity'>): string {
  return `${trip.originCity.name} → ${trip.destinationCity.name}`;
}