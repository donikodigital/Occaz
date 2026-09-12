// web-admin/src/hooks/useDisputes.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { disputesApi } from '@/services/api/disputes.api';
import type {
  AssignDisputePayload,
  DisputePriority,
  DisputeStatus,
  ResolveDisputePayload,
} from '@/types/disputes.types';

export function useDisputesList(params: { page?: number; status?: DisputeStatus; priority?: DisputePriority }) {
  return useQuery({
    queryKey: ['disputes', params],
    queryFn: () => disputesApi.listAll({ ...params, limit: 20 }),
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

function useDisputeInvalidation(id: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['disputes', id] });
    queryClient.invalidateQueries({ queryKey: ['disputes'] });
  };
}

export function useAddDisputeMessage(id: string) {
  const invalidate = useDisputeInvalidation(id);
  return useMutation({
    mutationFn: (message: string) => disputesApi.addMessage(id, message),
    onSuccess: invalidate,
  });
}

export function useAssignDispute(id: string) {
  const invalidate = useDisputeInvalidation(id);
  return useMutation({
    mutationFn: (payload: AssignDisputePayload) => disputesApi.assign(id, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateDisputeStatus(id: string) {
  const invalidate = useDisputeInvalidation(id);
  return useMutation({
    mutationFn: (status: DisputeStatus) => disputesApi.updateStatus(id, status),
    onSuccess: invalidate,
  });
}

export function useResolveDispute(id: string) {
  const invalidate = useDisputeInvalidation(id);
  return useMutation({
    mutationFn: (payload: ResolveDisputePayload) => disputesApi.resolve(id, payload),
    onSuccess: invalidate,
  });
}

export function useCloseDispute(id: string) {
  const invalidate = useDisputeInvalidation(id);
  return useMutation({
    mutationFn: () => disputesApi.close(id),
    onSuccess: invalidate,
  });
}
