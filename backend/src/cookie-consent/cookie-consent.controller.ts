// backend/src/cookie-consent/cookie-consent.controller.ts
import { Controller, Ip, Post, Body, Headers, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CookieConsentService } from './cookie-consent.service';
import { RecordCookieConsentDto } from './dto/record-cookie-consent.dto';

@ApiTags('Consentement cookies')
@Controller('cookie-consent')
export class CookieConsentController {
  constructor(private readonly cookieConsentService: CookieConsentService) {}

  /**
   * Public : le bandeau cookies s'affiche avant toute connexion. Si la
   * requête porte un jeton valide (visiteur déjà connecté), req.user est
   * renseigné par le guard JWT et le consentement lui est rattaché ;
   * sinon userId reste vide (visiteur anonyme, traçé par IP/agent utilisateur
   * uniquement).
   */
  @Public()
  @Post()
  record(
    @Body() dto: RecordCookieConsentDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() req: Request & { user?: { id: string } },
  ) {
    return this.cookieConsentService.record(dto, { userId: req.user?.id, ipAddress: ip, userAgent });
  }
}