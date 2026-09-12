// mobile/src/services/api/disputes.api.ts
import { api } from './client';
import type { CreateDisputePayload, Dispute, DisputeMessage } from '@/types/disputes.types';

export const disputesApi = {
  listMine: () => api.get<Dispute[]>('/disputes/mine'),

  create: (payload: CreateDisputePayload) => api.post<Dispute>('/disputes', payload),

  getOne: (id: string) => api.get<Dispute>(`/disputes/${id}`),

  addMessage: (id: string, message: string) => api.post<DisputeMessage>(`/disputes/${id}/messages`, { message }),
};
