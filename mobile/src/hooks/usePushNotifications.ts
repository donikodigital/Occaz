// mobile/src/hooks/usePushNotifications.ts
// [21/09/2026] v2 — canal Android « shipment-requests » (importance max) et ouverture de l'écran concerné au toucher d'une notification.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
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
 * Canal Android des nouvelles demandes d'envoi — même identifiant que
 * SHIPMENT_REQUEST_CHANNEL_ID côté backend (shipment-dispatch.service.ts),
 * qui l'indique dans chaque push. Importance maximale : l'alerte sonne, vibre
 * et s'affiche en bandeau même écran verrouillé, pour que le premier chauffeur
 * disponible puisse accepter tout de suite. Sur Android 8+ le son et
 * l'importance se règlent uniquement par canal, jamais par notification.
 */
const SHIPMENT_REQUEST_CHANNEL_ID = 'shipment-requests';

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SHIPMENT_REQUEST_CHANNEL_ID, {
    name: "Nouvelles demandes d'envoi",
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 250, 400],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

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
        // Avant la demande de permission : sur Android 13+, la fenêtre de permission n'apparaît qu'une fois un canal créé.
        await ensureAndroidChannels();

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

    // Toucher une notification ouvre directement l'écran concerné : la liste
    // des demandes pour un chauffeur, le suivi de l'envoi pour un client.
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string; shipmentId?: string } | undefined;
      if (data?.type === 'SHIPMENT_REQUEST') {
        router.push('/(driver)/shipment-available');
      } else if (data?.shipmentId && (data.type === 'SHIPMENT_EXTENSION' || data.type === 'DRIVER_ACCEPTED')) {
        router.push(`/(customer)/shipment/${data.shipmentId}`);
      }
    });

    return () => {
      cancelled = true;
      responseSubscription.remove();
    };
  }, [isAuthenticated]);
}