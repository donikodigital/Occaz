// web-admin/src/services/api/audit.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { AuditLogEntry } from '@/types/audit.types';

export const auditApi = {
  listAll: (params: { page?: number; limit?: number; entityType?: string; entityId?: string; actorId?: string }) =>
    api.get<Paginated<AuditLogEntry>>('/audit-logs', { query: params }),
};
