// web-admin/src/hooks/useCommissionSummary.ts
import { useQuery } from '@tanstack/react-query';
import { dashboardsApi } from '@/services/api/dashboards.api';
import type { CommissionSummaryPeriod } from '@/types/dashboards.types';

export function useCommissionSummary(period: CommissionSummaryPeriod) {
  return useQuery({
    queryKey: ['dashboards', 'admin', 'commission-summary', period],
    queryFn: () => dashboardsApi.getCommissionSummary(period),
  });
}