// web-admin/src/hooks/useCompanyDocuments.ts
// [25/10/2026] v1 — Documents de l'entreprise : liste, statistiques, ajout, modification, suppression, ouverture.
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { companyDocumentsApi } from '@/services/api/company-documents.api';
import type { CompanyDocument, CompanyDocumentCategory, CompanyDocumentFields } from '@/types/company-documents.types';

export function useCompanyDocuments(params: { page: number; category?: CompanyDocumentCategory; search?: string }) {
  return useQuery({
    queryKey: ['company-documents', params],
    queryFn: () => companyDocumentsApi.list({ ...params, limit: 12 }),
    placeholderData: keepPreviousData,
  });
}

export function useCompanyDocumentStats() {
  return useQuery({ queryKey: ['company-documents-stats'], queryFn: () => companyDocumentsApi.stats() });
}

/** Une modification de la liste change aussi les compteurs. */
function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['company-documents'] }),
      queryClient.invalidateQueries({ queryKey: ['company-documents-stats'] }),
    ]);
}

export function useUploadCompanyDocument() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { file: File; contentType: string; fields: CompanyDocumentFields; onProgress: (percent: number) => void }) =>
      companyDocumentsApi.upload(input),
    onSuccess: refresh,
  });
}

export function useUpdateCompanyDocument() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: CompanyDocumentFields }) => companyDocumentsApi.update(id, fields),
    onSuccess: refresh,
  });
}

export function useDeleteCompanyDocument() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (id: string) => companyDocumentsApi.remove(id), onSuccess: refresh });
}

export function useOpenCompanyDocument() {
  return useMutation({
    mutationFn: ({ doc, mode }: { doc: Pick<CompanyDocument, 'id' | 'opensInBrowser'>; mode: 'open' | 'download' }) => companyDocumentsApi.open(doc, mode),
  });
}
