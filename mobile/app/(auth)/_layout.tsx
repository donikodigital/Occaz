// mobile/app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="login-password" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="signup-email" options={{ gestureEnabled: false }} />
      <Stack.Screen name="signup-email-code" />
      <Stack.Screen name="signup-password" options={{ gestureEnabled: false }} />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="forgot-password-code" />
      <Stack.Screen name="forgot-password-new" />
    </Stack>
  );
}