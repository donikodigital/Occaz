// web-admin/src/hooks/useAdminDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { dashboardsApi } from '@/services/api/dashboards.api';

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['dashboards', 'admin'],
    queryFn: () => dashboardsApi.getAdminOverview(),
  });
}

export function useTopRoutes() {
  return useQuery({
    queryKey: ['dashboards', 'admin', 'top-routes'],
    queryFn: () => dashboardsApi.getTopRoutes(),
  });
}