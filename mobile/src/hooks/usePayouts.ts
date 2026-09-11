// mobile/src/hooks/usePayouts.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payoutsApi } from '@/services/api/payouts.api';
import type { RequestPayoutPayload } from '@/types/payouts.types';

export function useMyPayouts(page = 1) {
  return useQuery({
    queryKey: ['payouts', 'mine', page],
    queryFn: () => payoutsApi.listMine({ page, limit: 20 }),
  });
}

export function useRequestPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestPayoutPayload) => payoutsApi.request(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payouts', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}
