// mobile/src/hooks/useDriverTrips.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tripsApi } from '@/services/api/trips.api';
import type { CancelTripPayload, CreateTripPayload, TripStopInput, UpdateTripStopPayload } from '@/types/trips.types';

export function useMyTrips(page = 1) {
  return useQuery({
    queryKey: ['trips', 'mine', page],
    queryFn: () => tripsApi.listMine({ page, limit: 20 }),
  });
}

export function useTripBookings(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trips', tripId, 'bookings'],
    queryFn: () => tripsApi.findBookings(tripId!),
    enabled: Boolean(tripId),
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTripPayload) => tripsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', 'mine'] });
    },
  });
}

/**
 * Toutes les transitions de cycle de vie invalident le même jeu de
 * requêtes (détail du trajet + liste "mes trajets") — factorisé ici
 * plutôt que répété dans chaque hook de mutation individuel.
 */
function useTripLifecycleMutation(
  tripId: string,
  mutationFn: (id: string) => ReturnType<typeof tripsApi.publish>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => mutationFn(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips', 'mine'] });
    },
  });
}

export function usePublishTrip(tripId: string) {
  return useTripLifecycleMutation(tripId, tripsApi.publish);
}

export function useMarkDriverArrived(tripId: string) {
  return useTripLifecycleMutation(tripId, tripsApi.markDriverArrived);
}

export function useStartTrip(tripId: string) {
  return useTripLifecycleMutation(tripId, tripsApi.start);
}

export function useMarkTripArrived(tripId: string) {
  return useTripLifecycleMutation(tripId, tripsApi.markArrived);
}

export function useCompleteTrip(tripId: string) {
  return useTripLifecycleMutation(tripId, tripsApi.complete);
}

export function useCancelTrip(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CancelTripPayload) => tripsApi.cancel(tripId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips', 'mine'] });
    },
  });
}

/** Les étapes (villes traversées) se modifient en brouillon : chaque changement recharge le détail du trajet. */
function useStopMutation<TVariables, TResult>(tripId: string, mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips', 'mine'] });
    },
  });
}

export function useAddTripStop(tripId: string) {
  return useStopMutation(tripId, (payload: TripStopInput) => tripsApi.addStop(tripId, payload));
}

export function useUpdateTripStop(tripId: string) {
  return useStopMutation(tripId, ({ stopId, ...payload }: { stopId: string } & UpdateTripStopPayload) =>
    tripsApi.updateStop(tripId, stopId, payload),
  );
}

export function useRemoveTripStop(tripId: string) {
  return useStopMutation(tripId, (stopId: string) => tripsApi.removeStop(tripId, stopId));
}

export function useMarkArrivedAtStop(tripId: string) {
  return useStopMutation(tripId, (stopId: string) => tripsApi.markArrivedAtStop(tripId, stopId));
}
