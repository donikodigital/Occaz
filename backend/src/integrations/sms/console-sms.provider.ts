// backend/src/integrations/sms/console-sms.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';

/**
 * Fournisseur par défaut pour le développement : écrit le SMS dans les
 * logs au lieu de l'envoyer réellement. À remplacer par un provider
 * Orange Money / opérateur XOF en production via la config `sms.provider`.
 */
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SMS');

  async send(toPhone: string, message: string): Promise<void> {
    this.logger.log(`[SIMULATION SMS] -> ${toPhone} : ${message}`);
  }
}
