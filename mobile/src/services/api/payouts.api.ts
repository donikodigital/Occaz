// mobile/src/services/api/payouts.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { Payout, RequestPayoutPayload } from '@/types/payouts.types';

export const payoutsApi = {
  listMine: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<Payout>>('/payouts/mine', { query: params }),

  request: (payload: RequestPayoutPayload) => api.post<Payout>('/payouts', payload),
};
