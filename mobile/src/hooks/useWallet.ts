// mobile/src/hooks/useWallet.ts
import { useQuery } from '@tanstack/react-query';
import { walletsApi } from '@/services/api/wallets.api';

export function useMyWallet() {
  return useQuery({
    queryKey: ['wallet', 'mine'],
    queryFn: () => walletsApi.getMine(),
  });
}

export function useMyWalletTransactions(page = 1) {
  return useQuery({
    queryKey: ['wallet', 'transactions', page],
    queryFn: () => walletsApi.listMyTransactions({ page, limit: 20 }),
  });
}
