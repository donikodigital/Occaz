// backend/src/integrations/sms/sms.module.ts
// [19/10/2026] v2 — Politique d'envoi : le fournisseur est enveloppé par PolicySmsProvider (4 motifs autorisés seulement).
import { Module } from '@nestjs/common';
import { ConsoleSmsProvider } from './console-sms.provider';
import { InfobipSmsProvider } from './infobip-sms.provider';
import { isOrangeSmsConfigured, OrangeSmsProvider } from './orange-sms.provider';
import { PolicySmsProvider } from './policy-sms.provider';
import { CountryRoutingSmsProvider } from './routing-sms.provider';
import { TextBeeSmsProvider } from './textbee-sms.provider';
import { SMS_PROVIDER, SmsProvider } from './sms-provider.interface';

/**
 * Choix du fournisseur SMS selon les variables d'environnement, sans changement de code.
 *
 * Fournisseur international (tous les pays, et la Guinée tant qu'Orange n'est pas configuré) :
 *   1. INFOBIP_API_KEY  -> Infobip (serveurs cloud, couvre la zone XOF et la Guinée, mais plus cher) ;
 *   2. TEXTBEE_API_KEY  -> TextBee (dépannage : passerelle via un téléphone Android qui doit rester allumé) ;
 *   3. sinon            -> ConsoleSmsProvider, qui journalise le message (donc le code OTP) au lieu d'échouer.
 *
 * Guinée (+224) : si ORANGE_SMS_CLIENT_ID et ORANGE_SMS_CLIENT_SECRET sont renseignées, ces numéros passent par l'API SMS d'Orange
 * (environ 100 à 200 GNF par SMS) ; le reste du monde continue d'utiliser le fournisseur international ci-dessus.
 *
 * Avant, sans aucune clé, OtpService.generateAndSend (aucun try/catch autour de l'appel SMS) levait une exception non rattrapée : le
 * repli console permet de tester tous les flux OTP en local sans compte chez un fournisseur.
 */
export function createSmsProvider(env: NodeJS.ProcessEnv = process.env): SmsProvider {
  const international: SmsProvider = env.INFOBIP_API_KEY
    ? new InfobipSmsProvider()
    : env.TEXTBEE_API_KEY
      ? new TextBeeSmsProvider()
      : new ConsoleSmsProvider();

  if (!isOrangeSmsConfigured(env)) return international;
  return new CountryRoutingSmsProvider([{ prefix: '+224', provider: new OrangeSmsProvider() }], international);
}

/**
 * Le fournisseur choisi est enveloppé par la politique d'envoi (PolicySmsProvider) : seuls l'inscription, le mot de passe oublié, le
 * destinataire d'un colis et le nouveau numéro d'un changement de numéro envoient réellement un SMS (voir sms-purpose.ts). Tout autre motif est refusé avant d'atteindre le fournisseur.
 */
@Module({
  providers: [{ provide: SMS_PROVIDER, useFactory: () => new PolicySmsProvider(createSmsProvider()) }],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
