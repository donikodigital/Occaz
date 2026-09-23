// backend/src/cookie-consent/cookie-consent.module.ts
import { Module } from '@nestjs/common';
import { CookieConsentController } from './cookie-consent.controller';
import { CookieConsentService } from './cookie-consent.service';

@Module({
  controllers: [CookieConsentController],
  providers: [CookieConsentService],
})
export class CookieConsentModule {}