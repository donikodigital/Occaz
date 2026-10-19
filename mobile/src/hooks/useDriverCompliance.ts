// mobile/src/hooks/useDriverCompliance.ts
// [19/10/2026] v1 — État du dossier du conducteur : pièces manquantes, jours restants avant le blocage de la création de trajets.
import { useQuery } from '@tanstack/react-query';
import { accountRolesApi } from '@/services/api/accountRoles.api';

export function useDriverCompliance(enabled = true) {
  return useQuery({
    queryKey: ['driver-compliance', 'mine'],
    queryFn: () => accountRolesApi.getDriverCompliance(),
    enabled,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
