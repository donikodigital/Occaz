// mobile/app/(customer)/_layout.tsx
import { Stack } from 'expo-router';
import { colors } from '@/theme';

/**
 * Stack racine de l'espace client : héberge le groupe (tabs) (Accueil,
 * Trajets, Profil) ainsi que les écrans du parcours de réservation qui
 * se superposent aux onglets (recherche, résultats, détail, réservation).
 */
export default function CustomerLayout() {
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
      <Stack.Screen name="select-city" options={{ presentation: 'modal' }} />
      <Stack.Screen name="select-location" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip-search" />
      <Stack.Screen name="trip-results" />
      <Stack.Screen name="trip/[id]" />
      <Stack.Screen name="booking/new" />
      <Stack.Screen name="booking/[id]" />
      <Stack.Screen name="shipment-new" />
      <Stack.Screen name="shipment/[id]" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="rate" />
    </Stack>
  );
}
