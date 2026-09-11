// mobile/src/hooks/useBookings.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/services/api/bookings.api';
import type { CancelBookingPayload, CreateBookingPayload } from '@/types/bookings.types';

export function useMyBookings(page = 1) {
  return useQuery({
    queryKey: ['bookings', 'mine', page],
    queryFn: () => bookingsApi.listMine({ page, limit: 20 }),
  });
}

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: () => bookingsApi.getOne(id!),
    enabled: Boolean(id),
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBookingPayload) => bookingsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] });
    },
  });
}

export function useCancelBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CancelBookingPayload) => bookingsApi.cancel(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', id] });
    },
  });
}

// --- Côté chauffeur : validation OTP de prise en charge / dépose ---

export function useRequestPickupOtp(bookingId: string, tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bookingsApi.requestPickupOtp(bookingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'bookings'] }),
  });
}

export function useVerifyPickupOtp(bookingId: string, tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => bookingsApi.verifyPickupOtp(bookingId, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'bookings'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
    },
  });
}

export function useRequestDropoffOtp(bookingId: string, tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bookingsApi.requestDropoffOtp(bookingId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'bookings'] }),
  });
}

export function useVerifyDropoffOtp(bookingId: string, tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => bookingsApi.verifyDropoffOtp(bookingId, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'bookings'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
    },
  });
}
