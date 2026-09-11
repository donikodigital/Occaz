// mobile/src/services/api/customerProfiles.api.ts
import { api } from './client';
import type { CreateCustomerProfilePayload, CustomerProfile } from '@/types/profiles.types';

export const customerProfilesApi = {
  getMine: () => api.get<CustomerProfile>('/customer-profiles/me'),

  createMine: (payload: CreateCustomerProfilePayload) =>
    api.post<CustomerProfile>('/customer-profiles/me', payload),

  updateMine: (payload: Partial<CreateCustomerProfilePayload>) =>
    api.patch<CustomerProfile>('/customer-profiles/me', payload),
};
