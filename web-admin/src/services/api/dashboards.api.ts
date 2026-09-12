// web-admin/src/services/api/dashboards.api.ts
import { api } from './client';
import type { AdminDashboardOverview } from '@/types/dashboards.types';

export const dashboardsApi = {
  getAdminOverview: () => api.get<AdminDashboardOverview>('/dashboards/admin'),
};
