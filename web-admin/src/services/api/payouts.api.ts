// web-admin/src/services/api/payouts.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { PayoutConfig, PayoutListItem, PayoutStatus } from '@/types/payouts.types';

export const payoutsApi = {
  listAll: (params: { page?: number; limit?: number; status?: PayoutStatus }) =>
    api.get<Paginated<PayoutListItem>>('/payouts', { query: params }),

  getConfig: () => api.get<PayoutConfig>('/payouts/config'),

  setMode: (autoEnabled: boolean) => api.patch<PayoutConfig>('/payouts/mode', { autoEnabled }),

  /** Valide un retrait en attente et l'envoie tout de suite par le prestataire de paiement. */
  approve: (id: string) => api.patch<PayoutListItem>(`/payouts/${id}/approve`),

  markProcessing: (id: string) => api.patch<PayoutListItem>(`/payouts/${id}/processing`),

  markPaid: (id: string) => api.patch<PayoutListItem>(`/payouts/${id}/paid`),

  markFailed: (id: string, reason: string) => api.patch<PayoutListItem>(`/payouts/${id}/failed`, { reason }),
};
