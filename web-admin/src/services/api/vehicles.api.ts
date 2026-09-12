// web-admin/src/services/api/vehicles.api.ts
import { api } from './client';
import type { Vehicle } from '@/types/drivers.types';

export const vehiclesApi = {
  verify: (id: string) => api.patch<Vehicle>(`/vehicles/${id}/verify`),

  reject: (id: string) => api.patch<Vehicle>(`/vehicles/${id}/reject`),
};
