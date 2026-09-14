// mobile/src/services/api/devices.api.ts
import { api } from './client';
import type { Device, RegisterDevicePayload } from '@/types/devices.types';

export const devicesApi = {
  listMine: () => api.get<Device[]>('/devices'),

  register: (payload: RegisterDevicePayload) => api.post<Device>('/devices', payload),

  remove: (id: string) => api.delete<void>(`/devices/${id}`),
};
