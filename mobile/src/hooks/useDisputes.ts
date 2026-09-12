// mobile/src/hooks/useDisputes.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disputesApi } from '@/services/api/disputes.api';
import type { CreateDisputePayload } from '@/types/disputes.types';

export function useMyDisputes() {
  return useQuery({
    queryKey: ['disputes', 'mine'],
    queryFn: () => disputesApi.listMine(),
  });
}

export function useDispute(id: string | undefined) {
  return useQuery({
    queryKey: ['disputes', id],
    queryFn: () => disputesApi.getOne(id!),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  });
}

export function useCreateDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDisputePayload) => disputesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes', 'mine'] });
    },
  });
}

export function useAddDisputeMessage(disputeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (message: string) => disputesApi.addMessage(disputeId, message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes', disputeId] });
    },
  });
}
