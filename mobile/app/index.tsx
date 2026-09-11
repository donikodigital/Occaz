// mobile/app/index.tsx
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

/** Point d'entrée — aiguille vers le flux d'authentification ou l'espace connecté selon le type de compte. */
export default function Index() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accountType = useAuthStore((state) => state.user?.accountType);

  if (isAuthenticated) {
    return <Redirect href={accountType === 'DRIVER' ? '/(driver)/home' : '/(customer)/(tabs)/home'} />;
  }
  return <Redirect href="/(auth)/onboarding" />;
}
