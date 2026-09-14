// mobile/src/services/api/driverProfiles.api.ts
import { api } from './client';
import type { CreateDriverProfilePayload, DriverProfile } from '@/types/profiles.types';
import type { AppDocument, CreateDocumentPayload, RequestUploadUrlPayload, UploadUrlResult } from '@/types/documents.types';

export const driverProfilesApi = {
  getMine: () => api.get<DriverProfile>('/driver-profiles/me'),

  createMine: (payload: CreateDriverProfilePayload) =>
    api.post<DriverProfile>('/driver-profiles/me', payload),

  updateMine: (payload: Partial<CreateDriverProfilePayload>) =>
    api.patch<DriverProfile>('/driver-profiles/me', payload),

  requestDocumentUploadUrl: (payload: RequestUploadUrlPayload) =>
    api.post<UploadUrlResult>('/driver-profiles/me/documents/upload-url', payload),

  confirmDocument: (payload: CreateDocumentPayload) =>
    api.post<AppDocument>('/driver-profiles/me/documents', payload),

  listMyDocuments: () => api.get<AppDocument[]>('/driver-profiles/me/documents'),

  requestPhotoUploadUrl: (payload: RequestUploadUrlPayload) =>
    api.post<UploadUrlResult>('/driver-profiles/me/photo/upload-url', payload),

  confirmPhoto: (storageKey: string) =>
    api.post<DriverProfile>('/driver-profiles/me/photo', { storageKey }),
};
