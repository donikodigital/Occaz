// web-admin/src/hooks/useDrivers.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { driverProfilesApi } from '@/services/api/driverProfiles.api';
import type { DriverAccountStatus, SuspendDriverPayload } from '@/types/drivers.types';

export function useDriversList(params: { page?: number; search?: string; status?: DriverAccountStatus }) {
  return useQuery({
    queryKey: ['drivers', params],
    queryFn: () => driverProfilesApi.listAll({ ...params, limit: 20 }),
  });
}

export function useDriver(id: string | undefined) {
  return useQuery({
    queryKey: ['drivers', id],
    queryFn: () => driverProfilesApi.getOne(id!),
    enabled: Boolean(id),
  });
}

function useDriverMutation(id: string, mutationFn: (id: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => mutationFn(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['drivers', id] });
    },
  });
}

export function useVerifyDriver(id: string) {
  return useDriverMutation(id, driverProfilesApi.verify);
}

export function useReactivateDriver(id: string) {
  return useDriverMutation(id, driverProfilesApi.reactivate);
}

export function useSuspendDriver(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SuspendDriverPayload) => driverProfilesApi.suspend(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['drivers', id] });
    },
  });
}
