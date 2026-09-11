// mobile/src/services/api/driverProfiles.api.ts
import { api } from './client';
import type { CreateDriverProfilePayload, DriverProfile } from '@/types/profiles.types';

export const driverProfilesApi = {
  getMine: () => api.get<DriverProfile>('/driver-profiles/me'),

  createMine: (payload: CreateDriverProfilePayload) =>
    api.post<DriverProfile>('/driver-profiles/me', payload),

  updateMine: (payload: Partial<CreateDriverProfilePayload>) =>
    api.patch<DriverProfile>('/driver-profiles/me', payload),
};
