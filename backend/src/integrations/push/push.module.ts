// backend/src/integrations/push/push.module.ts
import { Module } from '@nestjs/common';
import { ConsolePushProvider } from './console-push.provider';
import { PUSH_PROVIDER } from './push-provider.interface';

@Module({
  providers: [{ provide: PUSH_PROVIDER, useClass: ConsolePushProvider }],
  exports: [PUSH_PROVIDER],
})
export class PushModule {}
