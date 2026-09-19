// web-admin/src/hooks/useRevenueTimeSeries.ts
import { useQuery } from '@tanstack/react-query';
import { dashboardsApi } from '@/services/api/dashboards.api';
import type { RevenueGranularity } from '@/types/dashboards.types';

export function useRevenueTimeSeries(granularity: RevenueGranularity, from: string, to: string) {
  return useQuery({
    queryKey: ['dashboards', 'admin', 'revenue-time-series', granularity, from, to],
    queryFn: () => dashboardsApi.getRevenueTimeSeries({ granularity, from, to }),
  });
}