// web-admin/src/services/api/safety.api.ts
// [11/10/2026] v1 — signalements d'utilisateurs et alertes SOS.
import { api } from './client';
import type { Paginated } from './types';
import type {
  HandleSosPayload,
  SosAlertItem,
  SosStatus,
  UpdateUserReportPayload,
  UserReportItem,
  UserReportStatus,
} from '@/types/safety.types';

export const safetyApi = {
  listReports: (params: { page?: number; limit?: number; status?: UserReportStatus }) =>
    api.get<Paginated<UserReportItem>>('/reports', { query: params }),

  reportsOpenCount: () => api.get<{ count: number }>('/reports/open-count'),

  updateReport: (id: string, payload: UpdateUserReportPayload) =>
    api.patch<{ id: string; status: UserReportStatus }>(`/reports/${id}`, payload),

  listSos: (params: { page?: number; limit?: number; status?: SosStatus }) =>
    api.get<Paginated<SosAlertItem>>('/sos', { query: params }),

  sosOpenCount: () => api.get<{ count: number }>('/sos/open-count'),

  handleSos: (id: string, payload: HandleSosPayload) => api.patch<{ id: string; status: SosStatus }>(`/sos/${id}`, payload),
};
