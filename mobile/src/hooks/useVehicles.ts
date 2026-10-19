// mobile/src/hooks/useVehicles.ts
// [19/10/2026] v+ — l'ajout d'un véhicule rafraîchit l'état du dossier du conducteur.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from '@/services/api/vehicles.api';
import type { CreateVehiclePayload, UpdateVehiclePayload } from '@/types/vehicles.types';

export function useMyVehicles() {
  return useQuery({
    queryKey: ['vehicles', 'mine'],
    queryFn: () => vehiclesApi.listMine(),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateVehiclePayload) => vehiclesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['driver-compliance', 'mine'] });
    },
  });
}

export function useUpdateVehicle(vehicleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateVehiclePayload) => vehiclesApi.update(vehicleId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'mine'] });
    },
  });
}