// web-admin/src/hooks/useStaffAccounts.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { staffAccountsApi } from '@/services/api/staffAccounts.api';
import type { CreateStaffAccountPayload } from '@/types/staff-accounts.types';

export function useStaffAccounts() {
  return useQuery({ queryKey: ['staff-accounts'], queryFn: () => staffAccountsApi.list() });
}

export function useCreateStaffAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStaffAccountPayload) => staffAccountsApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-accounts'] }),
  });
}

export function useResendStaffInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => staffAccountsApi.resendInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-accounts'] }),
  });
}
