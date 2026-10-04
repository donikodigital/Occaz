// backend/src/auth/auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Ip, Post, Headers } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { AuthService } from './auth.service';
import { PhoneChangeService } from './phone-change.service';
import { RequestPhoneChangeDto } from './dto/request-phone-change.dto';
import { ConfirmPhoneChangeDto } from './dto/confirm-phone-change.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginPasswordDto } from './dto/login-password.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import { EnableTwoFactorDto } from './dto/enable-two-factor.dto';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly phoneChangeService: PhoneChangeService,
  ) {}

  // Chaque demande de code coûte un SMS : 5 par minute et par adresse IP (en plus de la limite par numéro dans le service).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('otp/verify')
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.verifyOtpAndLogin(dto, { ipAddress: ip, userAgent });
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  loginWithPassword(
    @Body() dto: LoginPasswordDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.loginWithPassword(dto, { ipAddress: ip, userAgent });
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('password-reset/request')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('password-reset/confirm')
  confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    return this.authService.confirmPasswordReset(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user.sessionId);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.id);
  }

  /** Changement de numéro, étape 1 : envoie un code par SMS au NOUVEAU numéro (compte connecté). */
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('phone-change/request')
  requestPhoneChange(@Body() dto: RequestPhoneChangeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.phoneChangeService.request(user.id, dto.newPhone);
  }

  /** Changement de numéro, étape 2 : le bon code remplace le numéro du compte ; renvoie le compte à jour. */
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('phone-change/confirm')
  confirmPhoneChange(@Body() dto: ConfirmPhoneChangeDto, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.phoneChangeService.confirm(user.id, dto.newPhone, dto.code, { ipAddress: ip });
  }

  @ApiBearerAuth()
  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.setupTwoFactor(user.id);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('2fa/enable')
  enableTwoFactor(@Body() dto: EnableTwoFactorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.authService.enableTwoFactor(user.id, dto.code);
  }
}
