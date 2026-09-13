// mobile/src/hooks/useDriverDocuments.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { driverProfilesApi } from '@/services/api/driverProfiles.api';
import { useDocumentUpload } from './useDocumentUpload';

export function useMyDriverDocuments() {
  return useQuery({
    queryKey: ['driver-documents', 'mine'],
    queryFn: () => driverProfilesApi.listMyDocuments(),
  });
}

export function useDriverDocumentUpload() {
  const queryClient = useQueryClient();
  return useDocumentUpload({
    requestUploadUrl: (payload) => driverProfilesApi.requestDocumentUploadUrl(payload),
    confirmDocument: (payload) => driverProfilesApi.confirmDocument(payload),
    onUploaded: () => queryClient.invalidateQueries({ queryKey: ['driver-documents', 'mine'] }),
  });
}
