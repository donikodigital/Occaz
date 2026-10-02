// web-admin/src/services/api/supportDashboard.api.ts
import { api } from './client';
import type { SupportDashboardOverview } from '@/types/supportDashboard.types';

export const supportDashboardApi = {
  getOverview: () => api.get<SupportDashboardOverview>('/dashboards/support'),
};