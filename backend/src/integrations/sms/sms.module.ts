// backend/src/integrations/sms/sms.module.ts
import { Module } from '@nestjs/common';
import { ConsoleSmsProvider } from './console-sms.provider';
import { InfobipSmsProvider } from './infobip-sms.provider';
import { TextBeeSmsProvider } from './textbee-sms.provider';
import { SMS_PROVIDER, SmsProvider } from './sms-provider.interface';

/**
 * Choix du fournisseur SMS selon les variables d'environnement, sans changement de code :
 *   1. INFOBIP_API_KEY  -> Infobip (production : serveurs cloud, couvre la Guinée et la zone XOF) ;
 *   2. TEXTBEE_API_KEY  -> TextBee (dépannage : passerelle via un téléphone Android qui doit rester allumé) ;
 *   3. sinon            -> ConsoleSmsProvider, qui journalise le message (donc le code OTP) au lieu d'échouer.
 *
 * Avant, sans aucune clé, OtpService.generateAndSend (aucun try/catch autour de l'appel SMS) levait une exception non rattrapée : le
 * repli console permet de tester tous les flux OTP en local sans compte chez un fournisseur.
 */
export function createSmsProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  if (env.INFOBIP_API_KEY) return new InfobipSmsProvider();
  if (env.TEXTBEE_API_KEY) return new TextBeeSmsProvider();
  return new ConsoleSmsProvider();
}

@Module({
  providers: [{ provide: SMS_PROVIDER, useFactory: () => createSmsProvider() }],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
