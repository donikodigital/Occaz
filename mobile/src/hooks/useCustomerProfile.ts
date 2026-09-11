// mobile/src/hooks/useCustomerProfile.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customerProfilesApi } from '@/services/api/customerProfiles.api';
import { ApiError } from '@/services/api/ApiError';
import type { CreateCustomerProfilePayload } from '@/types/profiles.types';

/**
 * 404 est un état attendu (profil pas encore créé après l'inscription,
 * section 57) — jamais retenté, et distingué explicitement d'une vraie
 * erreur réseau pour que l'écran sache rediriger vers la complétion de
 * profil plutôt qu'afficher un message d'erreur.
 */
export function useCustomerProfile() {
  return useQuery({
    queryKey: ['customer-profile', 'mine'],
    queryFn: () => customerProfilesApi.getMine(),
    retry: false,
  });
}

export function useCreateCustomerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCustomerProfilePayload) => customerProfilesApi.createMine(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-profile', 'mine'] });
    },
  });
}

export function isProfileMissingError(error: unknown): boolean {
  return error instanceof ApiError && error.statusCode === 404;
}
