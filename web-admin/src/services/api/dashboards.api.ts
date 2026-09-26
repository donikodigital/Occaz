// web-admin/src/services/api/dashboards.api.ts
import { api } from './client';
import type {
  ActivityTimeSeriesPoint,
  AdminDashboardOverview,
  CommissionSummary,
  CommissionSummaryPeriod,
  RevenueGranularity,
  RevenueTimeSeriesPoint,
  TopRoute,
} from '@/types/dashboards.types';

export const dashboardsApi = {
  getAdminOverview: () => api.get<AdminDashboardOverview>('/dashboards/admin'),

  getCommissionSummary: (period: CommissionSummaryPeriod) =>
    api.get<CommissionSummary>('/dashboards/admin/commission-summary', { query: { period } }),

  getRevenueTimeSeries: (params: { granularity: RevenueGranularity; from: string; to: string }) =>
    api.get<RevenueTimeSeriesPoint[]>('/dashboards/admin/revenue-time-series', { query: params }),

  getActivityTimeSeries: (params: { granularity: RevenueGranularity; from: string; to: string }) =>
    api.get<ActivityTimeSeriesPoint[]>('/dashboards/admin/activity-time-series', { query: params }),

  getTopRoutes: () => api.get<TopRoute[]>('/dashboards/admin/top-routes'),
};