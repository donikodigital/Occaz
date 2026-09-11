// backend/src/integrations/push/console-push.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { PushProvider } from './push-provider.interface';

/**
 * Fournisseur par défaut pour le développement : journalise au lieu
 * d'envoyer réellement. À remplacer par un vrai client Expo/Firebase
 * Cloud Messaging avant mise en production (section 27).
 */
@Injectable()
export class ConsolePushProvider implements PushProvider {
  private readonly logger = new Logger('Push');

  async send(pushTokens: string[], title: string, body: string): Promise<void> {
    if (pushTokens.length === 0) {
      this.logger.warn('[SIMULATION PUSH] Aucun token — notification non envoyée.');
      return;
    }
    this.logger.log(`[SIMULATION PUSH] -> ${pushTokens.length} appareil(s) : ${title} — ${body}`);
  }
}
