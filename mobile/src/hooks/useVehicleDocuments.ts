// mobile/src/hooks/useVehicleDocuments.ts
// [23/10/2026] v+ — useDeleteVehicleDocument : le conducteur supprime une pièce de son véhicule (carte grise) ; son dossier est recalculé.
// [19/10/2026] v+ — un envoi de pièce rafraîchit aussi l'état du dossier du conducteur.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from '@/services/api/vehicles.api';
import { useDocumentUpload } from './useDocumentUpload';

export function useVehicleDocuments(vehicleId: string | undefined) {
  return useQuery({
    queryKey: ['vehicle-documents', vehicleId],
    queryFn: () => vehiclesApi.listDocuments(vehicleId!),
    enabled: Boolean(vehicleId),
  });
}

export function useVehicleDocumentUpload(vehicleId: string) {
  const queryClient = useQueryClient();
  return useDocumentUpload({
    requestUploadUrl: (payload) => vehiclesApi.requestDocumentUploadUrl(vehicleId, payload),
    confirmDocument: (payload) => vehiclesApi.confirmDocument(vehicleId, payload),
    onUploaded: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver-compliance', 'mine'] });
      return queryClient.invalidateQueries({ queryKey: ['vehicle-documents', vehicleId] });
    },
  });
}

export function useDeleteVehicleDocument(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => vehiclesApi.deleteDocument(vehicleId, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver-compliance', 'mine'] });
      return queryClient.invalidateQueries({ queryKey: ['vehicle-documents', vehicleId] });
    },
  });
}
