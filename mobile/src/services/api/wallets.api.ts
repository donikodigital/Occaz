// mobile/src/services/api/wallets.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { Wallet, WalletSummary, WalletTransaction, WalletTxFilter } from '@/types/wallets.types';

/** Une page de l'historique, avec les totaux de TOUTES les catégories (quel que soit le filtre demandé). */
export type WalletHistoryPage = Paginated<WalletTransaction> & { summary: WalletSummary };

export const walletsApi = {
  getMine: () => api.get<Wallet>('/wallets/mine'),

  listMyTransactions: (params: { page?: number; limit?: number; category?: WalletTxFilter } = {}) =>
    api.get<WalletHistoryPage>('/wallets/mine/transactions', { query: params }),
};
