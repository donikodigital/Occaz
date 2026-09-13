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

export interface TripLocation {
  id: string;
  label: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  cityId: string | null;
}

export interface TripStop {
  id: string;
  tripId: string;
  locationId: string;
  location?: TripLocation;
  sequence: number;
  estimatedArrivalAt: string | null;
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
  currencyId: string;
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
