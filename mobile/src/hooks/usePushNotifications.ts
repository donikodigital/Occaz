// mobile/src/hooks/usePushNotifications.ts
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { devicesApi } from '@/services/api/devices.api';

/**
 * Sans ce réglage, une notification reçue pendant que l'app est ouverte
 * au premier plan ne s'affiche pas visuellement par défaut sur certaines
 * plateformes — configuré une seule fois au chargement du module.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Enregistre l'appareil pour les notifications push — appelé une fois
 * authentifié (voir app/_layout.tsx), jamais avant, puisque
 * POST /devices exige une session. Entièrement best-effort : aucune
 * étape ne doit jamais bloquer ni planter l'app (refus de permission,
 * EAS pas encore configuré, hors-ligne...), une notification manquée
 * n'est jamais aussi grave qu'un écran cassé.
 */
export function usePushNotificationRegistration(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;

    async function register() {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted' || cancelled) return;

        // Tant que `eas build:configure` n'a pas été lancé, ce champ
        // reste le texte indicatif de app.json — on n'essaie pas
        // d'obtenir un token dans ce cas plutôt que d'échouer bruyamment.
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId || typeof projectId !== 'string' || projectId.startsWith('REMPLACER_')) return;

        const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled) return;

        const platform: 'ios' | 'android' | 'web' = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
        await devicesApi.register({ platform, pushToken: expoPushToken });
      } catch {
        // Silencieux par nature — voir le commentaire en tête de fonction.
      }
    }

    register();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);
}
