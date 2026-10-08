// web-admin/src/services/api/platform-wallet.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type {
  BeneficiaryInput,
  PlatformBeneficiary,
  PlatformWalletOverview,
  PlatformWithdrawal,
  PlatformWithdrawalStatus,
  WithdrawalInput,
} from '@/types/platform-wallet.types';

export const platformWalletApi = {
  overview: () => api.get<PlatformWalletOverview>('/platform-wallet'),

  beneficiaries: () => api.get<PlatformBeneficiary[]>('/platform-wallet/beneficiaries'),
  createBeneficiary: (input: BeneficiaryInput) => api.post<PlatformBeneficiary>('/platform-wallet/beneficiaries', input),
  updateBeneficiary: (id: string, input: Partial<BeneficiaryInput> & { isActive?: boolean }) =>
    api.patch<PlatformBeneficiary>(`/platform-wallet/beneficiaries/${id}`, input),

  withdrawals: (params: { page?: number; limit?: number; status?: PlatformWithdrawalStatus; currencyId?: string }) =>
    api.get<Paginated<PlatformWithdrawal>>('/platform-wallet/withdrawals', { query: params }),
  withdraw: (input: WithdrawalInput) => api.post<PlatformWithdrawal>('/platform-wallet/withdrawals', input),
  markPaid: (id: string, externalReference?: string) =>
    api.patch<PlatformWithdrawal>(`/platform-wallet/withdrawals/${id}/paid`, { externalReference: externalReference || undefined }),
  markFailed: (id: string, reason: string) => api.patch<PlatformWithdrawal>(`/platform-wallet/withdrawals/${id}/failed`, { reason }),
};
