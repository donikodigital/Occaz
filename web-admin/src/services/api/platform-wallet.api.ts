// web-admin/src/services/api/platform-wallet.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type {
  BeneficiaryInput,
  ExpenseCategory,
  PayslipPreview,
  PlatformBeneficiary,
  PlatformWalletOverview,
  PlatformWithdrawal,
  PlatformWithdrawalStatus,
  WithdrawalCodeRequest,
  WithdrawalCodeResponse,
  WithdrawalInput,
} from '@/types/platform-wallet.types';

export const platformWalletApi = {
  overview: () => api.get<PlatformWalletOverview>('/platform-wallet'),

  beneficiaries: () => api.get<PlatformBeneficiary[]>('/platform-wallet/beneficiaries'),
  createBeneficiary: (input: BeneficiaryInput) => api.post<PlatformBeneficiary>('/platform-wallet/beneficiaries', input),
  updateBeneficiary: (id: string, input: Partial<BeneficiaryInput> & { isActive?: boolean }) =>
    api.patch<PlatformBeneficiary>(`/platform-wallet/beneficiaries/${id}`, input),

  withdrawals: (params: {
    page?: number;
    limit?: number;
    status?: PlatformWithdrawalStatus;
    currencyId?: string;
    category?: ExpenseCategory;
    year?: number;
    month?: number;
  }) =>
    api.get<Paginated<PlatformWithdrawal>>('/platform-wallet/withdrawals', { query: params }),
  requestWithdrawalCode: (input: WithdrawalCodeRequest) =>
    api.post<WithdrawalCodeResponse>('/platform-wallet/withdrawals/code', input),
  withdraw: (input: WithdrawalInput) => api.post<PlatformWithdrawal>('/platform-wallet/withdrawals', input),
  markPaid: (id: string, externalReference?: string) =>
    api.patch<PlatformWithdrawal>(`/platform-wallet/withdrawals/${id}/paid`, { externalReference: externalReference || undefined }),
  payslipPreview: (staffUserId: string, period: string) =>
    api.get<PayslipPreview>('/platform-wallet/payslip-preview', { query: { staffUserId, period } }),
  markFailed: (id: string, reason: string) => api.patch<PlatformWithdrawal>(`/platform-wallet/withdrawals/${id}/failed`, { reason }),
};
