// web-admin/src/types/trips.types.ts
// Types de la liste et du détail admin des trajets (GET /trips, GET /trips/:id, GET /trips/:id/bookings).
import type { Money } from '@/services/api/types';

export type TripStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'BOOKING_PENDING'
  | 'CONFIRMED'
  | 'DRIVER_ARRIVED'
  | 'PASSENGER_PICKED_UP'
  | 'IN_PROGRESS'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED'
  | 'REFUNDED';

/** Chauffeur tel que l'API l'expose ici — jamais ses coordonnées de paiement. */
export interface TripDriverSummary {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  averageRating: number | null;
  ratingsCount: number;
}

export interface TripVehicleSummary {
  id: string;
  brand: string;
  model: string;
  color: string | null;
  plateNumber: string;
  totalSeats: number;
}

export interface TripCitySummary {
  id: string;
  name: string;
}

export interface TripLocationSummary {
  id: string;
  label: string;
  city?: TripCitySummary | null;
}

export interface TripStopSummary {
  id: string;
  sequence: number;
  estimatedArrivalAt: string | null;
  location: TripLocationSummary;
}

/** Une ligne de la liste admin (GET /trips). */
export interface AdminTripListItem {
  id: string;
  status: TripStatus;
  departureAt: string;
  originCity: TripCitySummary;
  destinationCity: TripCitySummary;
  totalSeats: number;
  availableSeats: number;
  pricePerSeat: Money;
  currency?: { isoCode: string } | null;
  driver: TripDriverSummary;
  createdAt: string;
}

/** Détail admin d'un trajet (GET /trips/:id) — un seul trajet, potentiellement plusieurs réservations. */
export interface AdminTripDetail extends AdminTripListItem {
  vehicle: TripVehicleSummary;
  originLocation: TripLocationSummary;
  destinationLocation: TripLocationSummary;
  stops: TripStopSummary[];
  allowsLuggage: boolean;
  allowsShipments: boolean;
  notes: string | null;
  /** pricePerSeat + commission plateforme — ce que paie un passager, jamais le prix brut fixé par le chauffeur. */
  customerPricePerSeat: Money;
}

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'REFUNDED'
  | 'DISPUTED';

export interface TripBookingPassenger {
  id: string;
  fullName: string;
  phone: string | null;
  pickedUpAt: string | null;
  droppedOffAt: string | null;
}

export interface BookingCustomerSummary {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
}

/**
 * Une réservation sur ce trajet (GET /trips/:id/bookings). customerPhone
 * n'est révélé par l'API qu'une fois la réservation CONFIRMED/COMPLETED
 * (mise en relation après paiement) — null avant, jamais filtré côté
 * front : c'est le serveur qui décide quoi renvoyer.
 */
export interface TripBookingSummary {
  id: string;
  status: BookingStatus;
  seatsCount: number;
  totalAmount: Money;
  customer: BookingCustomerSummary;
  customerPhone: string | null;
  passengers: TripBookingPassenger[];
  createdAt: string;
}