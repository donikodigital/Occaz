// backend/src/auth/biometric-auth.controller.ts
// [30/10/2026] v1 — Connexion rapide par empreinte digitale (ou visage).
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { BiometricAuthService } from './biometric-auth.service';
import { BiometricLoginDto, DisableBiometricDto, EnableBiometricDto } from './dto/biometric.dto';

@ApiTags('Authentification — empreinte digitale')
@Controller('auth/biometric')
export class BiometricAuthController {
  constructor(private readonly biometric: BiometricAuthService) {}

  /** Active l'empreinte sur ce téléphone (compte connecté, mot de passe demandé). */
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('enable')
  enable(@Body() dto: EnableBiometricDto, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.biometric.enable(user.id, dto, { ipAddress: ip });
  }

  /** Connexion avec le secret libéré par l'empreinte (route publique : l'utilisateur n'est pas encore connecté). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: BiometricLoginDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.biometric.login(dto, { ipAddress: ip, userAgent });
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('disable')
  disable(@Body() dto: DisableBiometricDto, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.biometric.disable(user.id, dto.credentialId, { ipAddress: ip });
  }

  /** Téléphones sur lesquels l'empreinte est active. */
  @ApiBearerAuth()
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.biometric.list(user.id);
  }
}
