// web-admin/src/hooks/useUsers.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/services/api/users.api';
import type { AccountType } from '@/types/auth.types';
import type { AdminUpdateUserPayload, SuspendUserPayload } from '@/types/users.types';

export function useUsersList(params: { page?: number; search?: string; accountType?: AccountType }) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.listAll({ ...params, limit: 20 }),
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersApi.getOne(id!),
    enabled: Boolean(id),
  });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminUpdateUserPayload) => usersApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useSuspendUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SuspendUserPayload) => usersApi.suspend(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUnsuspendUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.unsuspend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeactivateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useActivateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.activate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}