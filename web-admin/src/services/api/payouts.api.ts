// web-admin/src/services/api/payouts.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { PayoutListItem, PayoutStatus } from '@/types/payouts.types';

export const payoutsApi = {
  listAll: (params: { page?: number; limit?: number; status?: PayoutStatus }) =>
    api.get<Paginated<PayoutListItem>>('/payouts', { query: params }),

  markProcessing: (id: string) => api.patch<PayoutListItem>(`/payouts/${id}/processing`),

  markPaid: (id: string) => api.patch<PayoutListItem>(`/payouts/${id}/paid`),

  markFailed: (id: string, reason: string) => api.patch<PayoutListItem>(`/payouts/${id}/failed`, { reason }),
};
