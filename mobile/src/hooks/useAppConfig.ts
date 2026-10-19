// mobile/src/hooks/useAppConfig.ts
// [19/10/2026] v1 — Réglages publics de l'application, mis en cache 10 minutes. Une erreur réseau ne bloque jamais l'application :
// sans réponse, aucune mise à jour n'est exigée et les textes restent prudents.
import { useQuery } from '@tanstack/react-query';
import { appConfigApi } from '@/services/api/appConfig.api';

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: appConfigApi.get,
    staleTime: 10 * 60_000,
    retry: 1,
  });
}
