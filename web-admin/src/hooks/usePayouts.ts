// web-admin/src/hooks/usePayouts.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payoutsApi } from '@/services/api/payouts.api';
import type { PayoutStatus } from '@/types/payouts.types';

export function usePayoutsList(params: { page?: number; status?: PayoutStatus }) {
  return useQuery({
    queryKey: ['payouts', params],
    queryFn: () => payoutsApi.listAll({ ...params, limit: 20 }),
    // Un retrait en attente de validation doit apparaître sans que l'admin ait à recharger la page.
    refetchInterval: 30_000,
  });
}

/** Mode Automatique / Manuel, état du prestataire et nombre de retraits à valider. */
export function usePayoutConfig() {
  return useQuery({
    queryKey: ['payout-config'],
    queryFn: () => payoutsApi.getConfig(),
    refetchInterval: 30_000,
  });
}

function usePayoutInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['payouts'] }),
      // Le compteur « en attente de validation » change à chaque décision.
      queryClient.invalidateQueries({ queryKey: ['payout-config'] }),
    ]);
}

export function useSetPayoutMode() {
  const invalidate = usePayoutInvalidation();
  return useMutation({ mutationFn: (autoEnabled: boolean) => payoutsApi.setMode(autoEnabled), onSuccess: invalidate });
}

export function useApprovePayout() {
  const invalidate = usePayoutInvalidation();
  return useMutation({ mutationFn: (id: string) => payoutsApi.approve(id), onSuccess: invalidate });
}

export function useMarkPayoutProcessing() {
  const invalidate = usePayoutInvalidation();
  return useMutation({ mutationFn: (id: string) => payoutsApi.markProcessing(id), onSuccess: invalidate });
}

export function useMarkPayoutPaid() {
  const invalidate = usePayoutInvalidation();
  return useMutation({ mutationFn: (id: string) => payoutsApi.markPaid(id), onSuccess: invalidate });
}

export function useMarkPayoutFailed() {
  const invalidate = usePayoutInvalidation();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => payoutsApi.markFailed(id, reason),
    onSuccess: invalidate,
  });
}
