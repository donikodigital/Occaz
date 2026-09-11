// mobile/src/hooks/useDriverProfile.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { driverProfilesApi } from '@/services/api/driverProfiles.api';
import { ApiError } from '@/services/api/ApiError';
import type { CreateDriverProfilePayload } from '@/types/profiles.types';

/** Même principe que useCustomerProfile.ts — voir sa note sur le 404 attendu. */
export function useDriverProfile() {
  return useQuery({
    queryKey: ['driver-profile', 'mine'],
    queryFn: () => driverProfilesApi.getMine(),
    retry: false,
  });
}

export function useCreateDriverProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDriverProfilePayload) => driverProfilesApi.createMine(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-profile', 'mine'] });
    },
  });
}

export function useUpdateDriverProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateDriverProfilePayload>) => driverProfilesApi.updateMine(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-profile', 'mine'] });
    },
  });
}

export function isDriverProfileMissingError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 404;
}
