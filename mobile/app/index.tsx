// mobile/app/index.tsx
// [19/10/2026] v+ — ouvre l'espace actif (compte passager + conducteur) ; sinon celui du type de compte. L'ancienne adresse '/(driver)/home' est remplacée par celle des onglets.
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useActiveSpaceStore } from '@/stores/activeSpaceStore';
import { HOME_HREF, spaceOfAccountType } from '@/utils/spaces';

/** Point d'entrée — aiguille vers le flux d'authentification ou l'espace connecté selon le type de compte. */
export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accountType = useAuthStore((state) => state.user?.accountType);
  const activeSpace = useActiveSpaceStore((state) => state.space);

  if (isAuthenticated) {
    return <Redirect href={HOME_HREF[activeSpace ?? spaceOfAccountType(accountType)]} />;
  }
  return <Redirect href="/(auth)/onboarding" />;
}
