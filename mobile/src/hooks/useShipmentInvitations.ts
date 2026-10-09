// mobile/src/hooks/useShipmentInvitations.ts
// [09/10/2026] v1 — le client cherche et invite des conducteurs ; le conducteur répond aux invitations reçues.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shipmentsApi } from '@/services/api/shipments.api';
import type { SearchDriversParams } from '@/types/shipments.types';

// --- Client ---

/** `params` nul tant que la ville d'arrivée n'est pas choisie : aucune recherche. */
export function useDriverSearch(shipmentId: string | undefined, params: SearchDriversParams | null) {
  return useQuery({
    queryKey: ['shipments', shipmentId, 'drivers', params],
    queryFn: () => shipmentsApi.searchDrivers(shipmentId!, params!),
    enabled: Boolean(shipmentId && params),
  });
}

export function useShipmentInvitations(shipmentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['shipments', shipmentId, 'invitations'],
    queryFn: () => shipmentsApi.listInvitations(shipmentId!),
    enabled: Boolean(shipmentId) && enabled,
    refetchInterval: 30_000,
  });
}

export function useInviteDrivers(shipmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripIds: string[]) => shipmentsApi.inviteDrivers(shipmentId, tripIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments', shipmentId, 'drivers'] });
      queryClient.invalidateQueries({ queryKey: ['shipments', shipmentId, 'invitations'] });
    },
  });
}

// --- Conducteur ---

/** Invitations à traiter : la bannière de l'accueil se met à jour toute seule. */
export function useMyInvitations(enabled = true) {
  return useQuery({
    queryKey: ['shipments', 'invitations', 'mine'],
    queryFn: () => shipmentsApi.listMyInvitations(),
    enabled,
    refetchInterval: 30_000,
  });
}

function useInvalidateAfterAnswer() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['shipments', 'invitations', 'mine'] });
    queryClient.invalidateQueries({ queryKey: ['shipments', 'available'] });
    queryClient.invalidateQueries({ queryKey: ['shipments', 'assigned-to-me'] });
  };
}

export function useAcceptInvitation() {
  const invalidate = useInvalidateAfterAnswer();
  return useMutation({
    mutationFn: (invitationId: string) => shipmentsApi.acceptInvitation(invitationId),
    onSuccess: invalidate,
    // Pris par un autre conducteur : l'invitation disparaît aussi de la liste.
    onError: invalidate,
  });
}

export function useDeclineInvitation() {
  const invalidate = useInvalidateAfterAnswer();
  return useMutation({
    mutationFn: (invitationId: string) => shipmentsApi.declineInvitation(invitationId),
    onSuccess: invalidate,
  });
}
