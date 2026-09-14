// backend/src/integrations/push/push.module.ts
import { Module } from '@nestjs/common';
import { ExpoPushProvider } from './expo-push.provider';
import { PUSH_PROVIDER } from './push-provider.interface';

/**
 * Contrairement à SMS/paiement (qui exigent un vrai compte avant de
 * basculer), le service push d'Expo est gratuit et sans compte à créer —
 * ExpoPushProvider est donc le choix par défaut ici, pas ConsolePushProvider
 * (toujours disponible dans ce dossier si un jour un environnement de test
 * a besoin de ne jamais envoyer de vraies notifications).
 */
@Module({
  providers: [
    {
      provide: PUSH_PROVIDER,
      useClass: ExpoPushProvider,
    },
  ],
  exports: [PUSH_PROVIDER],
})
export class PushModule {}
