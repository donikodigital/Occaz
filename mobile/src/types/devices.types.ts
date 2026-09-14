// mobile/src/types/devices.types.ts
export type DevicePlatform = 'ios' | 'android' | 'web';

export interface Device {
  id: string;
  platform: DevicePlatform;
  pushToken: string | null;
  isTrusted: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface RegisterDevicePayload {
  platform: DevicePlatform;
  pushToken?: string;
}
