// mobile/src/services/api/vehicles.api.ts
import { api } from './client';
import type { CreateVehiclePayload, Vehicle } from '@/types/vehicles.types';
import type { AppDocument, CreateDocumentPayload, RequestUploadUrlPayload, UploadUrlResult } from '@/types/documents.types';

export const vehiclesApi = {
  listMine: () => api.get<Vehicle[]>('/vehicles/mine'),

  create: (payload: CreateVehiclePayload) => api.post<Vehicle>('/vehicles', payload),

  requestDocumentUploadUrl: (vehicleId: string, payload: RequestUploadUrlPayload) =>
    api.post<UploadUrlResult>(`/vehicles/${vehicleId}/documents/upload-url`, payload),

  confirmDocument: (vehicleId: string, payload: CreateDocumentPayload) =>
    api.post<AppDocument>(`/vehicles/${vehicleId}/documents`, payload),

  listDocuments: (vehicleId: string) => api.get<AppDocument[]>(`/vehicles/${vehicleId}/documents`),
};
