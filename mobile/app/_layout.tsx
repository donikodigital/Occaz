// mobile/app/_layout.tsx
import React, { useEffect, useState } from 'react';
import { ErrorBoundary as ExpoRouterErrorBoundary, Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme';
import { usePushNotificationRegistration } from '@/hooks/usePushNotifications';
import { AnimatedSplash } from '@/components/screens/AnimatedSplash';
import { initMonitoring, withMonitoredErrorBoundary, withMonitoring } from '@/services/monitoring';
import '@/tasks/tripLocationTask';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Suivi des erreurs (Sentry) : sans EXPO_PUBLIC_SENTRY_DSN, rien n'est initialisé et rien n'est envoyé.
initMonitoring();

// Écran d'erreur d'Expo Router (affiché quand un écran plante à l'affichage) : inchangé pour l'utilisateur, mais l'erreur est
// maintenant remontée au suivi.
export const ErrorBoundary = withMonitoredErrorBoundary(ExpoRouterErrorBoundary);

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const hydrate = useAuthStore((state) => state.hydrate);
  const isHydrating = useAuthStore((state) => state.isHydrating);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  usePushNotificationRegistration(isAuthenticated);
  // Le splash natif (SplashScreen) est une image statique — aucune
  // animation n'y est possible, c'est une contrainte système, pas un
  // choix. Dès qu'il disparaît, cette intro JS prend le relais pendant
  // ~2s (gouttes, pin qui atterrit, vagues) avant de révéler l'app,
  // déjà montée en dessous — la vraie app n'attend donc pas la fin de
  // l'animation pour charger.
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (fontsLoaded && !isHydrating) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, isHydrating]);

  if (!fontsLoaded || isHydrating) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Slot />
          {showIntro ? <AnimatedSplash onFinish={() => setShowIntro(false)} /> : null}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default withMonitoring(RootLayout);
