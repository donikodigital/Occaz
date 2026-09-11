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
