// mobile/src/types/bookings.types.ts
import type { Money } from '@/services/api/types';
import type { Trip } from './trips.types';

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'REFUNDED'
  | 'DISPUTED';

export interface TripPassenger {
  id: string;
  tripId: string;
  bookingId: string;
  fullName: string;
  phone: string | null;
  seatNumber: number | null;
  pickedUpAt: string | null;
  droppedOffAt: string | null;
}

export interface Booking {
  id: string;
  tripId: string;
  trip?: Trip;
  customerId: string;
  seatsCount: number;
  pricePerSeat: Money;
  platformFee: Money;
  totalAmount: Money;
  currencyId: string;
  status: BookingStatus;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  passengers?: TripPassenger[];
  createdAt: string;
  updatedAt: string;
}

export interface PassengerInput {
  fullName: string;
  phone?: string;
}

export interface CreateBookingPayload {
  tripId: string;
  seatsCount: number;
  passengers?: PassengerInput[];
}

export interface CancelBookingPayload {
  reason: string;
}
