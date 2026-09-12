// web-admin/src/hooks/useVehicles.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from '@/services/api/vehicles.api';

/** Invalide le détail du chauffeur (qui inclut ses véhicules) plutôt qu'une liste de véhicules à part — voir drivers.types.ts. */
export function useVerifyVehicle(driverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vehicleId: string) => vehiclesApi.verify(vehicleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers', driverId] }),
  });
}

export function useRejectVehicle(driverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vehicleId: string) => vehiclesApi.reject(vehicleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drivers', driverId] }),
  });
}
