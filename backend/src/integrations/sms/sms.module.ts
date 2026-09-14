// backend/src/integrations/sms/sms.module.ts
import { Module } from '@nestjs/common';
import { TextBeeSmsProvider } from './textbee-sms.provider';
import { SMS_PROVIDER } from './sms-provider.interface';

/**
 * Basculé sur TextBee dès maintenant plutôt que de laisser
 * ConsoleSmsProvider par défaut — même raisonnement que EmailModule
 * pour Resend : tant que TEXTBEE_API_KEY n'est pas renseignée, chaque
 * tentative d'envoi échoue proprement, jamais de crash.
 */
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useClass: TextBeeSmsProvider,
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
