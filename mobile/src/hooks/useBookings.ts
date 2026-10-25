// mobile/src/hooks/useBookings.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingsApi } from '@/services/api/bookings.api';
import { PAGE_SIZE, usePagedList } from '@/hooks/usePagedList';
import type { CancelBookingPayload, CreateBookingPayload } from '@/types/bookings.types';

export function useMyBookings(page = 1) {
  return useQuery({
    queryKey: ['bookings', 'mine', page],
    queryFn: () => bookingsApi.listMine({ page, limit: 20 }),
  });
}

/** Toutes les réservations du client, chargées par pages au fil du défilement (écran « Mon activité »). */
export function useMyBookingsList() {
  return usePagedList(['bookings', 'mine', 'list'], (page) => bookingsApi.listMine({ page, limit: PAGE_SIZE }));
}

/**
 * Tant que la réservation est active, l'écran se met à jour tout seul :
 * conducteur arrivé, pris en charge, dépose… (même principe que
 * useShipment). Sans ce polling, `trip.status` reste figé à sa valeur
 * du chargement de l'écran — la carte "Code de dépose" par exemple ne
 * peut jamais apparaître pour un client qui a ouvert l'écran avant que
 * le conducteur valide la prise en charge, même après un rafraîchissement
 * manuel classique (pull-to-refresh), tant que l'écran n'est pas
 * réellement rechargé.
 */
const LIVE_BOOKING_STATUSES = ['PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'DISPUTED'];

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: () => bookingsApi.getOne(id!),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && LIVE_BOOKING_STATUSES.includes(status) ? 15_000 : false;
    },
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

// --- Côté conducteur : validation OTP de prise en charge / dépose ---

/** Client absent au rendez-vous : la réservation est clôturée, le conducteur payé (solde et trajet se mettent à jour). */
export function useDeclareNoShow(bookingId: string, tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bookingsApi.declareNoShow(bookingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'bookings'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}

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

// --- Côté client : revoir son propre code dans l'app ---

export function useRevealPickupOtpForCustomer(bookingId: string) {
  return useMutation({ mutationFn: () => bookingsApi.revealPickupOtpForCustomer(bookingId) });
}

export function useRevealDropoffOtpForCustomer(bookingId: string) {
  return useMutation({ mutationFn: () => bookingsApi.revealDropoffOtpForCustomer(bookingId) });
}