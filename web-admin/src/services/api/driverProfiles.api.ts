// web-admin/src/services/api/driverProfiles.api.ts
import { api } from './client';
import type { Paginated } from './types';
import type { DriverAccountStatus, DriverProfile, SuspendDriverPayload } from '@/types/drivers.types';

export const driverProfilesApi = {
  listAll: (params: { page?: number; limit?: number; search?: string; status?: DriverAccountStatus; countryId?: string }) =>
    api.get<Paginated<DriverProfile>>('/driver-profiles', { query: params }),

  getOne: (id: string) => api.get<DriverProfile>(`/driver-profiles/${id}`),

  verify: (id: string) => api.patch<DriverProfile>(`/driver-profiles/${id}/verify`),

  suspend: (id: string, payload: SuspendDriverPayload) =>
    api.patch<DriverProfile>(`/driver-profiles/${id}/suspend`, payload),

  reactivate: (id: string) => api.patch<DriverProfile>(`/driver-profiles/${id}/reactivate`),
};
