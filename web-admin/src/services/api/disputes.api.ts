// web-admin/src/services/api/disputes.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type {
  AssignDisputePayload,
  Dispute,
  DisputeListItem,
  DisputeMessage,
  DisputePriority,
  DisputeResolution,
  DisputeStatus,
  ResolveDisputePayload,
} from '@/types/disputes.types';

export const disputesApi = {
  listAll: (params: { page?: number; limit?: number; status?: DisputeStatus; priority?: DisputePriority; assignedAgentId?: string }) =>
    api.get<Paginated<DisputeListItem>>('/disputes', { query: params }),

  getOne: (id: string) => api.get<Dispute>(`/disputes/${id}`),

  addMessage: (id: string, message: string) => api.post<DisputeMessage>(`/disputes/${id}/messages`, { message }),

  assign: (id: string, payload: AssignDisputePayload) => api.patch<Dispute>(`/disputes/${id}/assign`, payload),

  updateStatus: (id: string, status: DisputeStatus) => api.patch<Dispute>(`/disputes/${id}/status`, { status }),

  resolve: (id: string, payload: ResolveDisputePayload) =>
    api.post<DisputeResolution>(`/disputes/${id}/resolve`, payload),

  close: (id: string) => api.post<Dispute>(`/disputes/${id}/close`),
};
