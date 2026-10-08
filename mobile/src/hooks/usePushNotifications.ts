// mobile/src/hooks/usePushNotifications.ts
// [21/09/2026] v2 — canal Android « shipment-requests » (importance max) et ouverture de l'écran concerné au toucher d'une notification.
// [08/10/2026] v3 — son dédié aux messages d'échange : canal Android « messages », son joué à l'ouverture de l'app, pas de bannière si la
// conversation est déjà affichée, ouverture de la conversation au toucher. Les autres notifications gardent leur son habituel.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { devicesApi } from '@/services/api/devices.api';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { getActiveConversation, playMessageSound } from '@/utils/messageSound';

/**
 * Sans ce réglage, une notification reçue pendant que l'app est ouverte
 * au premier plan ne s'affiche pas visuellement par défaut sur certaines
 * plateformes — configuré une seule fois au chargement du module.
 */
type PushData = { type?: string; shipmentId?: string; conversationId?: string } | undefined;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as PushData;
    if (data?.type === 'CONVERSATION_MESSAGE') {
      // Message d'échange : le son est joué par l'app elle-même (playMessageSound, voir plus bas), jamais le son par défaut. Si la
      // conversation est déjà à l'écran, le message s'y affiche : pas de bannière par-dessus.
      const alreadyOnScreen = getActiveConversation() === data.conversationId;
      return {
        shouldShowBanner: !alreadyOnScreen,
        shouldShowList: !alreadyOnScreen,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

/**
 * Canal Android des nouvelles demandes d'envoi — même identifiant que
 * SHIPMENT_REQUEST_CHANNEL_ID côté backend (shipment-dispatch.service.ts),
 * qui l'indique dans chaque push. Importance maximale : l'alerte sonne, vibre
 * et s'affiche en bandeau même écran verrouillé, pour que le premier conducteur
 * disponible puisse accepter tout de suite. Sur Android 8+ le son et
 * l'importance se règlent uniquement par canal, jamais par notification.
 */
const SHIPMENT_REQUEST_CHANNEL_ID = 'shipment-requests';

/**
 * Canal Android des messages d'échange (client ↔ conducteur) — même identifiant que MESSAGE_CHANNEL_ID côté backend
 * (conversations.service.ts). Son propre son (assets/sounds/message.wav, déclaré dans app.json), distinct des autres notifications.
 */
const MESSAGE_CHANNEL_ID = 'messages';

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
  await Notifications.setNotificationChannelAsync(MESSAGE_CHANNEL_ID, {
    name: 'Messages',
    description: 'Messages reçus dans vos conversations',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'message.wav',
    vibrationPattern: [0, 200, 120, 200],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
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

    // App ouverte : un message d'échange qui arrive fait entendre son son, et la conversation concernée se met à jour tout de suite
    // (sans attendre l'actualisation automatique).
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as PushData;
      if (data?.type !== 'CONVERSATION_MESSAGE') return;
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Conversation déjà à l'écran : le son part quand le nouveau message apparaît dans la liste (useIncomingMessageSound).
      if (getActiveConversation() !== data.conversationId) void playMessageSound();
    });

    // Toucher une notification ouvre directement l'écran concerné : la liste
    // des demandes pour un conducteur, le suivi de l'envoi pour un client.
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as PushData;
      if (data?.type === 'CONVERSATION_MESSAGE' && data.conversationId) {
        // Les conversations vivent dans le groupe de l'utilisateur : conducteur ou client.
        const group = useAuthStore.getState().user?.accountType === 'DRIVER' ? '(driver)' : '(customer)';
        router.push(`/${group}/conversation/${data.conversationId}` as never);
      } else if (data?.type === 'SHIPMENT_REQUEST') {
        router.push('/(driver)/shipment-available');
      } else if (data?.shipmentId && (data.type === 'SHIPMENT_EXTENSION' || data.type === 'DRIVER_ACCEPTED')) {
        router.push(`/(customer)/shipment/${data.shipmentId}`);
      }
    });

    return () => {
      cancelled = true;
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [isAuthenticated]);
}