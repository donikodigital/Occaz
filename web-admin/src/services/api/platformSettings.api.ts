// web-admin/src/services/api/platformSettings.api.ts
import { api } from './client';
import type { PlatformSetting, UpsertPlatformSettingPayload } from '@/types/platformSettings.types';

export const platformSettingsApi = {
  listAll: () => api.get<PlatformSetting[]>('/platform-settings'),

  upsert: (payload: UpsertPlatformSettingPayload) => api.post<PlatformSetting>('/platform-settings', payload),

  remove: (key: string) => api.delete<void>(`/platform-settings/${key}`),
};
