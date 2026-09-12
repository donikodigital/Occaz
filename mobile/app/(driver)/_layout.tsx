// mobile/app/(driver)/_layout.tsx
import { Stack } from 'expo-router';
import { colors } from '@/theme';

/**
 * Stack racine de l'espace chauffeur : héberge le groupe (tabs)
 * (Accueil, Trajets, Profil) ainsi que les écrans qui se superposent
 * aux onglets (création de véhicule/trajet, détail d'un trajet).
 */
export default function DriverLayout() {
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
      <Stack.Screen name="vehicle-new" />
      <Stack.Screen name="trip-new" />
      <Stack.Screen name="trip/[id]" />
      <Stack.Screen name="shipment-available" />
      <Stack.Screen name="shipment/[id]" />
      <Stack.Screen name="payout-new" />
      <Stack.Screen name="conversation/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="disputes" />
      <Stack.Screen name="dispute-new" />
      <Stack.Screen name="dispute/[id]" />
    </Stack>
  );
}
