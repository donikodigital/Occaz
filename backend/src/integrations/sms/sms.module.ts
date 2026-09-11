// backend/src/integrations/sms/sms.module.ts
import { Module } from '@nestjs/common';
import { ConsoleSmsProvider } from './console-sms.provider';
import { SMS_PROVIDER } from './sms-provider.interface';

/**
 * Le choix du provider effectif se fait ici, au point de composition —
 * aucun autre module n'a besoin de savoir quelle implémentation est active.
 */
@Module({
  providers: [
    {
      provide: SMS_PROVIDER,
      useClass: ConsoleSmsProvider,
    },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
