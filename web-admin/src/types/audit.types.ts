// web-admin/src/types/audit.types.ts
export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actor?: { id: string; phone: string; email: string | null } | null;
  entityType: string;
  entityId: string;
  action: string;
  diff: unknown;
  ipAddress: string | null;
  createdAt: string;
}
