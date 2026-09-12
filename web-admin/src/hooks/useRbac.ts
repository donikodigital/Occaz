// web-admin/src/hooks/useRbac.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { permissionsApi, rolesApi, userRolesApi } from '@/services/api/rbac.api';
import type { AssignRolePayload, CreateRolePayload, UpdateRolePayload } from '@/types/rbac.types';

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.listAll(),
  });
}

export function useRole(id: string | undefined) {
  return useQuery({
    queryKey: ['roles', id],
    queryFn: () => rolesApi.getOne(id!),
    enabled: Boolean(id),
  });
}

export function usePermissionsCatalog() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsApi.listAll(),
    staleTime: 10 * 60_000,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRolePayload) => rolesApi.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateRolePayload) => rolesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['roles', id] });
    },
  });
}

export function useUserRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-roles', userId],
    queryFn: () => userRolesApi.listForUser(userId!),
    enabled: Boolean(userId),
  });
}

export function useAssignRole(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignRolePayload) => userRolesApi.assign(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-roles', userId] }),
  });
}

export function useRevokeRole(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userRoleId: string) => userRolesApi.revoke(userRoleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-roles', userId] }),
  });
}
