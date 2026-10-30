// backend/src/auth/trusted-device.controller.ts
// [30/10/2026] v1 — Téléphones de confiance : enregistrement, liste, retrait, et confirmation d'un nouveau téléphone par code.
import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Ip, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { AccountAuthService } from './account-auth.service';
import { TrustedDeviceService } from './trusted-device.service';
import { RegisterTrustedDeviceDto, ResendDeviceCodeDto, VerifyDeviceDto } from './dto/trusted-device.dto';

@ApiTags('Authentification — téléphones de confiance')
@Controller('auth')
export class TrustedDeviceController {
  constructor(
    private readonly trusted: TrustedDeviceService,
    private readonly accountAuth: AccountAuthService,
  ) {}

  /** Enregistre le téléphone de la session en cours (« Oui, faire confiance à ce téléphone »). */
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('trusted-devices')
  register(@Body() dto: RegisterTrustedDeviceDto, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.trusted.register(user.id, dto, { ipAddress: ip });
  }

  @ApiBearerAuth()
  @Get('trusted-devices')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.trusted.list(user.id);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('trusted-devices/:id')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.trusted.revoke(user.id, id, { ipAddress: ip });
  }

  /** Le code reçu confirme ce nouveau téléphone et ouvre la session. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('device-verification/verify')
  verify(@Body() dto: VerifyDeviceDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.accountAuth.verifyDeviceCode(dto, { ipAddress: ip, userAgent });
  }

  /** Nouveau code (par e-mail, ou par SMS si la personne n'a plus accès à son e-mail). */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('device-verification/resend')
  resend(@Body() dto: ResendDeviceCodeDto) {
    return this.accountAuth.resendDeviceCode(dto);
  }
}
