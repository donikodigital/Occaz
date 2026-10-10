// mobile/src/services/api/safety.api.ts
// [11/10/2026] v1 — SOS, proches à prévenir, signalements et blocages.
import { api } from './client';
import type {
  BlockedUser,
  CreateEmergencyContactPayload,
  CreateReportPayload,
  EmergencyContact,
  ReportResult,
  SosAlert,
  TriggerSosPayload,
  UserTarget,
} from '@/types/safety.types';

export const blocksApi = {
  list: () => api.get<BlockedUser[]>('/blocks'),
  block: (target: UserTarget) => api.post<{ blocked: true }>('/blocks', target),
  unblock: (userId: string) => api.delete<{ blocked: false }>(`/blocks/${userId}`),
};

export const reportsApi = {
  create: (payload: CreateReportPayload) => api.post<ReportResult>('/reports', payload),
};

export const emergencyContactsApi = {
  list: () => api.get<EmergencyContact[]>('/emergency-contacts'),
  add: (payload: CreateEmergencyContactPayload) => api.post<EmergencyContact>('/emergency-contacts', payload),
  remove: (id: string) => api.delete<{ deleted: true }>(`/emergency-contacts/${id}`),
};

export const sosApi = {
  trigger: (payload: TriggerSosPayload) => api.post<SosAlert>('/sos', payload),
  mine: () => api.get<SosAlert[]>('/sos/mine'),
  cancel: (id: string) => api.post<{ cancelled: true }>(`/sos/${id}/cancel`),
};
