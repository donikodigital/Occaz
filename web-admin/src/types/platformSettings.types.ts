// web-admin/src/types/platformSettings.types.ts
export interface PlatformSetting {
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string;
  updatedById: string | null;
}

export interface UpsertPlatformSettingPayload {
  key: string;
  value: unknown;
  description?: string;
}
