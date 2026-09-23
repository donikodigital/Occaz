// mobile/src/types/bookings.types.ts
// [23/09/2026] v+ — champ promoCode facultatif sur CreateBookingPayload.
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
  /** Code promo à appliquer, s'il y en a un — voir /promo-codes/validate pour l'aperçu avant envoi. */
  promoCode?: string;
}

export interface CancelBookingPayload {
  reason: string;
}