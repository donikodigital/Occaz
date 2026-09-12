// web-admin/src/hooks/useAuditLogs.ts
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/services/api/audit.api';

export function useAuditLogs(params: { page?: number; entityType?: string; actorId?: string }) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => auditApi.listAll({ ...params, limit: 25 }),
  });
}
