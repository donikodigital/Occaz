// mobile/src/hooks/useAccountRoles.ts
// [19/10/2026] v1 — Espaces du compte, ouverture de l'espace passager (conducteur) et bascule d'un espace à l'autre.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { accountRolesApi } from '@/services/api/accountRoles.api';
import { useActiveSpaceStore } from '@/stores/activeSpaceStore';
import { useAuthStore } from '@/stores/authStore';
import { HOME_HREF } from '@/utils/spaces';
import type { Space } from '@/types/roles.types';

export function useAccountRoles() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ['account', 'roles'],
    queryFn: () => accountRolesApi.getRoles(),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
}

/** Confirme avec le code PIN, crée le profil passager à partir du profil conducteur, puis ouvre l'espace passager. */
export function useActivateCustomerSpace() {
  const queryClient = useQueryClient();
  const setSpace = useActiveSpaceStore((state) => state.setSpace);
  return useMutation({
    mutationFn: (pin: string) => accountRolesApi.activateCustomer(pin),
    onSuccess: (roles) => {
      queryClient.setQueryData(['account', 'roles'], roles);
      void queryClient.invalidateQueries({ queryKey: ['customer-profile', 'mine'] });
      setSpace('CUSTOMER');
      router.replace(HOME_HREF.CUSTOMER);
    },
  });
}

/** Passe d'un espace à l'autre quand le profil de destination existe déjà. */
export function useSwitchSpace() {
  const setSpace = useActiveSpaceStore((state) => state.setSpace);
  return (space: Space) => {
    setSpace(space);
    router.replace(HOME_HREF[space]);
  };
}
