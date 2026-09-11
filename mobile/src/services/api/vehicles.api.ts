// mobile/src/services/api/vehicles.api.ts
import { api } from './client';
import type { CreateVehiclePayload, Vehicle } from '@/types/vehicles.types';

export const vehiclesApi = {
  listMine: () => api.get<Vehicle[]>('/vehicles/mine'),

  create: (payload: CreateVehiclePayload) => api.post<Vehicle>('/vehicles', payload),
};
