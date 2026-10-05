// mobile/src/hooks/useWallet.ts
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { walletsApi } from '@/services/api/wallets.api';
import type { WalletTxFilter } from '@/types/wallets.types';

const HISTORY_PAGE_SIZE = 20;

export function useMyWallet() {
  return useQuery({
    queryKey: ['wallet', 'mine'],
    queryFn: () => walletsApi.getMine(),
  });
}

/**
 * Historique du portefeuille, page après page (« Afficher plus »), filtré par catégorie. La clé commence par ['wallet'] : un retrait
 * ou un crédit qui invalide ['wallet'] recharge aussi l'historique. Les totaux de toutes les catégories sont dans la première page
 * (`summary`) ; en changeant de filtre, l'écran garde l'ancien contenu le temps de charger le nouveau.
 */
export function useMyWalletHistory(category: WalletTxFilter = 'ALL') {
  return useInfiniteQuery({
    queryKey: ['wallet', 'history', category],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => walletsApi.listMyTransactions({ page: pageParam, limit: HISTORY_PAGE_SIZE, category }),
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}
