// web-admin/src/hooks/usePlatformSettings.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformSettingsApi } from '@/services/api/platformSettings.api';
import type { UpsertPlatformSettingPayload } from '@/types/platformSettings.types';

export function usePlatformSettings() {
  return useQuery({
    queryKey: ['platform-settings'],
    queryFn: () => platformSettingsApi.listAll(),
  });
}

export function useUpsertPlatformSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertPlatformSettingPayload) => platformSettingsApi.upsert(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-settings'] }),
  });
}

export function useRemovePlatformSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => platformSettingsApi.remove(key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-settings'] }),
  });
}
