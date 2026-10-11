// mobile/app/(customer)/_layout.tsx
import { Redirect, Stack } from 'expo-router';
import { colors } from '@/theme';
import { useAuthStore } from '@/stores/authStore';

/**
 * Stack racine de l'espace client : héberge le groupe (tabs) (Accueil,
 * Trajets, Profil) ainsi que les écrans du parcours de réservation qui
 * se superposent aux onglets (recherche, résultats, détail, réservation).
 */
export default function CustomerLayout() {
  // Compte créé avant le mot de passe à 6 chiffres : on le fait définir une fois, avant d'ouvrir l'espace.
  const mustSetPassword = useAuthStore((state) => state.user?.mustSetPassword);
  if (mustSetPassword) return <Redirect href="/(auth)/signup-password" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="change-phone" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="select-city" options={{ presentation: 'modal' }} />
      <Stack.Screen name="select-location" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip-search" />
      <Stack.Screen name="trip-results" />
      <Stack.Screen name="trip/[id]" />
      <Stack.Screen name="booking/new" />
      <Stack.Screen name="booking/[id]" />
      <Stack.Screen name="shipment-new" />
      <Stack.Screen name="shipment/[id]" />
      <Stack.Screen name="shipment-tracking" />
      <Stack.Screen name="shipment-find-driver" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="rate" />
      <Stack.Screen name="conversation/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="disputes" />
      <Stack.Screen name="dispute-new" />
      <Stack.Screen name="dispute/[id]" />
    </Stack>
  );
}


