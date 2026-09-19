// web-admin/src/services/api/dashboards.api.ts
import { api } from './client';
import type {
  AdminDashboardOverview,
  CommissionSummary,
  CommissionSummaryPeriod,
  RevenueGranularity,
  RevenueTimeSeriesPoint,
} from '@/types/dashboards.types';

export const dashboardsApi = {
  getAdminOverview: () => api.get<AdminDashboardOverview>('/dashboards/admin'),

  getCommissionSummary: (period: CommissionSummaryPeriod) =>
    api.get<CommissionSummary>('/dashboards/admin/commission-summary', { query: { period } }),

  getRevenueTimeSeries: (params: { granularity: RevenueGranularity; from: string; to: string }) =>
    api.get<RevenueTimeSeriesPoint[]>('/dashboards/admin/revenue-time-series', { query: params }),
};