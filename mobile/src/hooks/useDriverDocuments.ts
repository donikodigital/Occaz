// mobile/src/hooks/useDriverDocuments.ts
// [19/10/2026] v+ — un envoi de pièce rafraîchit aussi l'état du dossier (jours restants, pièces manquantes).
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
    onUploaded: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver-compliance', 'mine'] });
      return queryClient.invalidateQueries({ queryKey: ['driver-documents', 'mine'] });
    },
  });
}
