// mobile/src/services/api/customerProfiles.api.ts
// [21/09/2026] v+ — photo de profil (upload-url puis confirmation), comme côté chauffeur.
import { api } from './client';
import type { RequestUploadUrlPayload, UploadUrlResult } from '@/types/documents.types';
import type { CreateCustomerProfilePayload, CustomerProfile } from '@/types/profiles.types';

export const customerProfilesApi = {
  getMine: () => api.get<CustomerProfile>('/customer-profiles/me'),

  createMine: (payload: CreateCustomerProfilePayload) =>
    api.post<CustomerProfile>('/customer-profiles/me', payload),

  updateMine: (payload: Partial<CreateCustomerProfilePayload>) =>
    api.patch<CustomerProfile>('/customer-profiles/me', payload),

  requestPhotoUploadUrl: (payload: RequestUploadUrlPayload) =>
    api.post<UploadUrlResult>('/customer-profiles/me/photo/upload-url', payload),

  confirmPhoto: (storageKey: string) =>
    api.post<CustomerProfile>('/customer-profiles/me/photo', { storageKey }),
};