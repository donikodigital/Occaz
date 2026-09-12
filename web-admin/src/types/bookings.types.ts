// web-admin/src/types/bookings.types.ts
import type { Money } from '@/services/api/types';

export interface TripPassenger {
  id: string;
  fullName: string;
  phone: string | null;
}

export interface BookingContext {
  id: string;
  tripId: string;
  customerId: string;
  seatsCount: number;
  totalAmount: Money;
  currencyId: string;
  status: string;
  passengers?: TripPassenger[];
  trip?: { id: string; departureAt: string; driverId: string };
}
