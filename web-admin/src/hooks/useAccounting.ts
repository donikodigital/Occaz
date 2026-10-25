// web-admin/src/hooks/useAccounting.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountingApi } from '@/services/api/accounting.api';
import type { StaffPayProfileInput } from '@/types/accounting.types';

export function useAccountingSummary(year: number | undefined) {
  return useQuery({ queryKey: ['accounting-summary', year], queryFn: () => accountingApi.summary(year), refetchInterval: 60_000 });
}

/** Personnel de l'administration et fiches de paie (réservé à ceux qui gèrent le portefeuille). */
export function useAccountingStaff(enabled = true) {
  return useQuery({ queryKey: ['accounting-staff'], queryFn: () => accountingApi.staff(), enabled });
}

export function useSavePayProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...input }: { userId: string } & StaffPayProfileInput) => accountingApi.savePayProfile(userId, input),
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['accounting-staff'] }),
      queryClient.invalidateQueries({ queryKey: ['payslip-preview'] }),
    ]),
  });
}

export function useExport() {
  return useMutation({
    mutationFn: ({ kind, year }: { kind: 'excel' | 'pdf'; year: number }) => (kind === 'excel' ? accountingApi.exportExcel(year) : accountingApi.exportPdf(year)),
  });
}

export function useDownloadDocument() {
  return useMutation({
    mutationFn: ({ id, documentNumber }: { id: string; documentNumber: string | null }) => accountingApi.downloadWithdrawalDocument(id, documentNumber),
  });
}
