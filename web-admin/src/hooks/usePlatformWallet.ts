// web-admin/src/hooks/usePlatformWallet.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformWalletApi } from '@/services/api/platform-wallet.api';
import type { BeneficiaryInput, PlatformWithdrawalStatus, WithdrawalInput } from '@/types/platform-wallet.types';

export function usePlatformWallet() {
  return useQuery({
    queryKey: ['platform-wallet'],
    queryFn: () => platformWalletApi.overview(),
    refetchInterval: 30_000,
  });
}

export function usePlatformBeneficiaries() {
  return useQuery({ queryKey: ['platform-beneficiaries'], queryFn: () => platformWalletApi.beneficiaries() });
}

export function usePlatformWithdrawals(params: { page?: number; status?: PlatformWithdrawalStatus }) {
  return useQuery({
    queryKey: ['platform-withdrawals', params],
    queryFn: () => platformWalletApi.withdrawals({ ...params, limit: 20 }),
    refetchInterval: 30_000,
  });
}

/** Un retrait change à la fois le solde et l'historique. */
function useWalletInvalidation() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['platform-wallet'] }),
      queryClient.invalidateQueries({ queryKey: ['platform-withdrawals'] }),
    ]);
}

export function useWithdrawCommissions() {
  const invalidate = useWalletInvalidation();
  return useMutation({ mutationFn: (input: WithdrawalInput) => platformWalletApi.withdraw(input), onSuccess: invalidate });
}

export function useMarkWithdrawalPaid() {
  const invalidate = useWalletInvalidation();
  return useMutation({
    mutationFn: ({ id, externalReference }: { id: string; externalReference?: string }) =>
      platformWalletApi.markPaid(id, externalReference),
    onSuccess: invalidate,
  });
}

export function useMarkWithdrawalFailed() {
  const invalidate = useWalletInvalidation();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => platformWalletApi.markFailed(id, reason),
    onSuccess: invalidate,
  });
}

export function useCreateBeneficiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BeneficiaryInput) => platformWalletApi.createBeneficiary(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-beneficiaries'] }),
  });
}

export function useUpdateBeneficiary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Partial<BeneficiaryInput> & { isActive?: boolean }) =>
      platformWalletApi.updateBeneficiary(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-beneficiaries'] }),
  });
}
