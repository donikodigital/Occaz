// web-admin/src/hooks/useSupportDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { supportDashboardApi } from '@/services/api/supportDashboard.api';

export function useSupportDashboard() {
  return useQuery({
    queryKey: ['dashboards', 'support'],
    queryFn: () => supportDashboardApi.getOverview(),
    // Une file de litiges bouge vite : on la rafraîchit toute seule pendant que l'agent reste sur la page.
    refetchInterval: 60_000,
  });
}