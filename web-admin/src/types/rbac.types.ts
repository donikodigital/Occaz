// web-admin/src/types/rbac.types.ts
export interface Permission {
  id: string;
  key: string;
  description: string | null;
}

export interface RolePermissionLink {
  roleId: string;
  permissionId: string;
  permission: Permission;
}

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  permissions: RolePermissionLink[];
}

export interface CreateRolePayload {
  key: string;
  name: string;
  description?: string;
  permissionKeys?: string[];
}

export type UpdateRolePayload = Partial<Omit<CreateRolePayload, 'key'>>;

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  role: Role;
  countryId: string | null;
  country?: { id: string; name: string } | null;
  assignedAt: string;
}

export interface AssignRolePayload {
  userId: string;
  roleId: string;
  countryId?: string;
}
