// backend/src/integrations/email/console-email.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './email-provider.interface';

/**
 * Fournisseur par défaut pour le développement — journalise au lieu
 * d'envoyer réellement. Section 27 : email "lorsque disponible", donc
 * un canal secondaire — à brancher sur un service email transactionnel
 * réel avant mise en production.
 */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('Email');

  async send(toEmail: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[SIMULATION EMAIL] -> ${toEmail} : ${subject} — ${body}`);
  }
}
