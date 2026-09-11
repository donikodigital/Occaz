// mobile/app/(driver)/_layout.tsx
import { Stack } from 'expo-router';
import { colors } from '@/theme';

/** Simple Stack pour ce Lot — voir la même note dans (customer)/_layout.tsx. */
export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="home" />
    </Stack>
  );
}
