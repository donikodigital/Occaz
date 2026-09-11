// mobile/src/services/api/wallets.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { Wallet, WalletTransaction } from '@/types/wallets.types';

export const walletsApi = {
  getMine: () => api.get<Wallet>('/wallets/mine'),

  listMyTransactions: (params: { page?: number; limit?: number } = {}) =>
    api.get<Paginated<WalletTransaction>>('/wallets/mine/transactions', { query: params }),
};
