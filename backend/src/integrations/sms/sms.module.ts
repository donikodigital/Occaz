// backend/src/integrations/sms/sms.module.ts
import { Module } from '@nestjs/common';
import { ConsoleSmsProvider } from './console-sms.provider';
import { TextBeeSmsProvider } from './textbee-sms.provider';
import { SMS_PROVIDER } from './sms-provider.interface';

/**
 * Bascule automatique : TEXTBEE_API_KEY absente (dev local, ou avant
 * configuration en production) -> ConsoleSmsProvider, qui journalise le
 * message (donc le code OTP) au lieu d'échouer. Dès que la clé est
 * renseignée, TextBee prend le relais sans aucun changement de code —
 * seule la variable d'environnement décide.
 *
 * Avant ce changement, TextBeeSmsProvider était toujours utilisé : sans
 * la clé, OtpService.generateAndSend (aucun try/catch autour de l'appel
 * SMS) levait une exception non rattrapée — impossible de tester le
 * moindre flux OTP (prise en charge, dépose, livraison colis...) en
 * local sans un compte TextBee réel et un appareil Android lié.
 */
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useFactory: () => (process.env.TEXTBEE_API_KEY ? new TextBeeSmsProvider() : new ConsoleSmsProvider()),
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}