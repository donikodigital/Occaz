// mobile/src/types/trips.types.ts
import type { Money } from '@/services/api/types';
import type { City } from './geography.types';

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

export interface DriverSummary {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  isVerifiedBadge: boolean;
  averageRating: number | null;
  ratingsCount: number;
  completedTripsCount: number;
}

export interface VehicleSummary {
  id: string;
  brand: string;
  model: string;
  color: string | null;
  plateNumber: string;
  type: string;
  totalSeats: number;
  photoUrl: string | null;
}

export interface TripLocationCountry {
  id: string;
  name: string;
  isoCode: string;
}

export interface TripLocationCity {
  id: string;
  name: string;
  country?: TripLocationCountry;
}

export interface TripLocation {
  id: string;
  label: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  cityId: string | null;
  /** Renseigné seulement là où le serveur l'inclut (ex. détail d'un envoi) — absent ailleurs. */
  city?: TripLocationCity | null;
}

export interface TripStop {
  id: string;
  tripId: string;
  locationId: string;
  location?: TripLocation;
  sequence: number;
  /** Heure de passage estimée (calculée automatiquement, modifiable par le conducteur). */
  estimatedArrivalAt: string | null;
  /** Ville traversée — le client la cherche comme une ville de départ ou d'arrivée. */
  cityId?: string | null;
  city?: { id: string; name: string; country?: { id?: string; name: string } | null } | null;
  /** Prix d'une place depuis le DÉPART jusqu'à cette étape (vue conducteur : sa propre saisie, jamais montré tel quel au client). */
  fareFromOrigin?: Money | null;
  distanceFromOriginKm?: number | null;
  /** false : le conducteur traverse cette ville sans prendre de passagers. */
  isBookable?: boolean;
  /** Renseigné quand le conducteur a signalé son arrivée à cette étape. */
  arrivedAt?: string | null;
}

/**
 * Tronçon d'un trajet : où le client monte et où il descend, à quelle heure il est pris en charge et le prix
 * d'une place avant commission. Sans étapes demandées, c'est le trajet entier (`isFullTrip`).
 */
export interface TripSegment {
  boardingStopId: string | null;
  alightingStopId: string | null;
  boardingCityId: string | null;
  alightingCityId: string | null;
  boardingCityName: string | null;
  alightingCityName: string | null;
  /** Heure estimée de passage au point de montée (départ du trajet si le client monte au départ). */
  boardingAt: string;
  isFullTrip: boolean;
  pricePerSeat: Money;
  /**
   * Places libres sur CE tronçon : le tronçon le plus chargé entre la montée et la descente décide. Un siège pris de
   * Conakry à Kindia est de nouveau libre de Kindia à Labé. null si le serveur ne l'a pas calculé.
   */
  availableSeats?: number | null;
}

/** Places d'un tronçon de la route (d'une ville à la suivante) — détail renvoyé avec le trajet quand il a des étapes. */
export interface SeatsByLeg {
  fromStopId: string | null;
  toStopId: string | null;
  fromCityName: string | null;
  toCityName: string | null;
  occupiedSeats: number;
  freeSeats: number;
}

/** Tronçon choisi par le client, transmis de la recherche au détail puis à la réservation. */
export interface SegmentSelection {
  boardingStopId?: string;
  alightingStopId?: string;
}

export interface Trip {
  id: string;
  driverId: string;
  driver: DriverSummary;
  vehicleId: string;
  vehicle: VehicleSummary;
  originCityId: string;
  originCity: City;
  originLocationId: string;
  originLocation?: TripLocation;
  destinationCityId: string;
  destinationCity: City;
  destinationLocationId: string;
  destinationLocation?: TripLocation;
  departureAt: string;
  status: TripStatus;
  totalSeats: number;
  availableSeats: number;
  allowsLuggage: boolean;
  allowsShipments: boolean;
  maxShipmentWeightKg: number | null;
  availableShipmentWeightKg: number | null;
  pricePerSeat: Money;
  /**
   * Prix affiché au client (pricePerSeat + commission plateforme) —
   * présent sur les réponses côté client (recherche, détail avant
   * réservation). Absent sur GET /trips/mine (vue chauffeur), qui doit
   * continuer d'afficher pricePerSeat tel quel : sa propre saisie.
   * Pour un tronçon (ex. Kindia → Labé), c'est le prix de CE tronçon.
   */
  customerPricePerSeat?: Money;
  /** Tronçon concerné (trajet entier si aucune étape n'est demandée) — présent sur les réponses client. */
  segment?: TripSegment;
  /** Places occupées et libres sur chaque tronçon de la route (trajets avec étapes, détail d'un trajet). */
  seatsByLeg?: SeatsByLeg[];
  currencyId: string;
  notes: string | null;
  stops?: TripStop[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchTripsParams {
  originCityId?: string;
  destinationCityId?: string;
  originLatitude?: number;
  originLongitude?: number;
  departureDate?: string;
  passengersCount?: number;
  requiresShipmentCapacity?: boolean;
  verifiedDriverOnly?: boolean;
  maxPricePerSeat?: string;
  page?: number;
  limit?: number;
}

export interface TripStopInput {
  locationId: string;
  sequence: number;
  estimatedArrivalAt?: string;
  /** Prix depuis le départ ; absent = calculé automatiquement au prorata de la distance. */
  fareFromOrigin?: string;
  isBookable?: boolean;
}

export interface UpdateTripStopPayload {
  fareFromOrigin?: string;
  estimatedArrivalAt?: string;
  isBookable?: boolean;
}

export interface CreateTripPayload {
  vehicleId: string;
  originCityId: string;
  originLocationId: string;
  destinationCityId: string;
  destinationLocationId: string;
  departureAt: string;
  totalSeats: number;
  pricePerSeat: string;
  /** Facultatif et ignoré par le serveur : la devise est celle du pays de la ville de départ. */
  currencyId?: string;
  allowsLuggage?: boolean;
  allowsShipments?: boolean;
  maxShipmentWeightKg?: number;
  notes?: string;
  stops?: TripStopInput[];
}

export interface CancelTripPayload {
  reason: string;
}

export interface TripPosition {
  latitude: number;
  longitude: number;
  updatedAt: string;
}