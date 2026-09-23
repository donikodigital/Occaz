// mobile/src/hooks/useRatings.ts
// [22/09/2026] v+ — useGivenRatings() pour « Mes avis ».
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ratingsApi } from '@/services/api/ratings.api';
import type { CreateRatingPayload } from '@/types/ratings.types';

export function useBookingRatings(bookingId: string | undefined) {
  return useQuery({
    queryKey: ['ratings', 'booking', bookingId],
    queryFn: () => ratingsApi.findForBooking(bookingId!),
    enabled: Boolean(bookingId),
  });
}

export function useShipmentRatings(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ['ratings', 'shipment', shipmentId],
    queryFn: () => ratingsApi.findForShipment(shipmentId!),
    enabled: Boolean(shipmentId),
  });
}

/** « Mes avis » — les notations données par l'utilisateur. */
export function useGivenRatings(page = 1) {
  return useQuery({
    queryKey: ['ratings', 'given', page],
    queryFn: () => ratingsApi.findGiven({ page, limit: 20 }),
  });
}

export function useRateBooking(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRatingPayload) => ratingsApi.rateBooking(bookingId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings', 'booking', bookingId] });
    },
  });
}

export function useRateShipment(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRatingPayload) => ratingsApi.rateShipment(shipmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings', 'shipment', shipmentId] });
    },
  });
}