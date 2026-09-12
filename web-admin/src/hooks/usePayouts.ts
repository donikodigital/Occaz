// web-admin/src/hooks/usePayouts.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payoutsApi } from '@/services/api/payouts.api';
import type { PayoutStatus } from '@/types/payouts.types';

export function usePayoutsList(params: { page?: number; status?: PayoutStatus }) {
  return useQuery({
    queryKey: ['payouts', params],
    queryFn: () => payoutsApi.listAll({ ...params, limit: 20 }),
  });
}

function usePayoutInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['payouts'] });
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
