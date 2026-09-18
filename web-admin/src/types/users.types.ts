// web-admin/src/types/users.types.ts
export interface SuspendUserPayload {
  reason: string;
}

export interface AdminUpdateUserPayload {
  email?: string;
  firstName?: string;
  lastName?: string;
}