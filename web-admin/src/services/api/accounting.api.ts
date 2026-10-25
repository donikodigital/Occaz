// web-admin/src/services/api/accounting.api.ts
import { api } from './client';
import { downloadFile } from './download';
import type { AccountingSummary, StaffPayProfileInput, StaffPaySummary } from '@/types/accounting.types';

export const accountingApi = {
  summary: (year?: number) => api.get<AccountingSummary>('/accounting/summary', { query: { year } }),
  exportExcel: (year: number) => downloadFile('/accounting/export/excel', { query: { year }, fallbackName: `comptabilite-${year}.xlsx` }),
  exportPdf: (year: number) => downloadFile('/accounting/export/pdf', { query: { year }, fallbackName: `comptabilite-${year}.pdf` }),

  staff: () => api.get<StaffPaySummary[]>('/accounting/staff'),
  savePayProfile: (userId: string, input: StaffPayProfileInput) => api.put<StaffPaySummary>(`/accounting/staff/${userId}/pay-profile`, input),

  /** Pièce comptable d'un retrait (bulletin, facture, reçu…) en PDF. */
  downloadWithdrawalDocument: (id: string, documentNumber: string | null) =>
    downloadFile(`/platform-wallet/withdrawals/${id}/document`, { fallbackName: `${documentNumber ?? 'piece'}.pdf` }),
};
