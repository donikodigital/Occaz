// mobile/src/hooks/useVehicleDocuments.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    onUploaded: () => queryClient.invalidateQueries({ queryKey: ['vehicle-documents', vehicleId] }),
  });
}
