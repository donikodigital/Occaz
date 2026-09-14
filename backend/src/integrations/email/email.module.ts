// backend/src/integrations/email/email.module.ts
import { Module } from '@nestjs/common';
import { ResendEmailProvider } from './resend-email.provider';
import { EMAIL_PROVIDER } from './email-provider.interface';

/**
 * Basculé sur Resend dès maintenant plutôt que de laisser
 * ConsoleEmailProvider par défaut : tant que RESEND_API_KEY n'est pas
 * renseignée (compte pas encore créé), chaque tentative d'envoi échoue
 * proprement — NotificationsService l'enregistre déjà comme un échec de
 * canal sans jamais planter (voir dispatchOne). Dès que le compte
 * existe, ça fonctionne sans autre changement de code.
 */
@Module({
  providers: [{ provide: EMAIL_PROVIDER, useClass: ResendEmailProvider }],
  exports: [EMAIL_PROVIDER],
})
export class EmailModule {}
