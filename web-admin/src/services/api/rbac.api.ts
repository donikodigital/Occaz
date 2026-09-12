// web-admin/src/services/api/rbac.api.ts
import { api } from './client';
import type {
  AssignRolePayload,
  CreateRolePayload,
  Permission,
  Role,
  UpdateRolePayload,
  UserRoleAssignment,
} from '@/types/rbac.types';

export const rolesApi = {
  listAll: () => api.get<Role[]>('/roles'),

  getOne: (id: string) => api.get<Role>(`/roles/${id}`),

  create: (payload: CreateRolePayload) => api.post<Role>('/roles', payload),

  update: (id: string, payload: UpdateRolePayload) => api.patch<Role>(`/roles/${id}`, payload),
};

export const permissionsApi = {
  listAll: () => api.get<Permission[]>('/permissions'),
};

export const userRolesApi = {
  listForUser: (userId: string) => api.get<UserRoleAssignment[]>(`/user-roles/${userId}`),

  assign: (payload: AssignRolePayload) => api.post<UserRoleAssignment>('/user-roles', payload),

  revoke: (userRoleId: string) => api.delete<void>(`/user-roles/${userRoleId}`),
};
