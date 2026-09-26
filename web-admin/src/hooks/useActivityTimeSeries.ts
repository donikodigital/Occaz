// web-admin/src/hooks/useActivityTimeSeries.ts
import { useQuery } from '@tanstack/react-query';
import { dashboardsApi } from '@/services/api/dashboards.api';
import type { RevenueGranularity } from '@/types/dashboards.types';

export function useActivityTimeSeries(granularity: RevenueGranularity, from: string, to: string) {
  return useQuery({
    queryKey: ['dashboards', 'admin', 'activity-time-series', granularity, from, to],
    queryFn: () => dashboardsApi.getActivityTimeSeries({ granularity, from, to }),
  });
}

