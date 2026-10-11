// backend/src/auth/account-auth.controller.ts
// [11/10/2026] v1 — Inscription en étapes, connexion par numéro + mot de passe, mot de passe oublié (clients et conducteurs).
import { Body, Controller, Headers, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { AccountAuthService } from './account-auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  ChangePasswordDto,
  ForgotPasswordRequestDto,
  ForgotPasswordResetDto,
  ForgotPasswordVerifyDto,
  LoginPhoneDto,
  RequestEmailCodeDto,
  SetPasswordDto,
  SignupPhoneDto,
  VerifyEmailCodeDto,
} from './dto/account-auth.dto';

@ApiTags('Authentification — compte client / conducteur')
@Controller('auth')
export class AccountAuthController {
  constructor(private readonly accountAuth: AccountAuthService) {}

  // Chaque demande de code coûte un SMS : 5 par minute et par adresse IP (en plus des limites par numéro dans le service).
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('signup/phone')
  signupPhone(@Body() dto: SignupPhoneDto) {
    return this.accountAuth.requestSignupCode(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('signup/phone/verify')
  signupPhoneVerify(@Body() dto: VerifyOtpDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.accountAuth.verifySignupCode(dto, { ipAddress: ip, userAgent });
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('email/request')
  requestEmail(@Body() dto: RequestEmailCodeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.accountAuth.requestEmailCode(user.id, dto.email);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('email/verify')
  verifyEmail(@Body() dto: VerifyEmailCodeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.accountAuth.verifyEmailCode(user.id, dto.email, dto.code);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('password/set')
  setPassword(@Body() dto: SetPasswordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.accountAuth.setPassword(user.id, dto.password);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('password/change')
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    return this.accountAuth.changePassword(user.id, dto, { ipAddress: ip, sessionId: user.sessionId });
  }

  // 10 essais par minute et par IP ; le verrouillage du compte (5 erreurs, 15 minutes) protège en plus chaque numéro.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login/phone')
  loginPhone(@Body() dto: LoginPhoneDto, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.accountAuth.loginWithPhone(dto, { ipAddress: ip, userAgent });
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password/request')
  forgotPasswordRequest(@Body() dto: ForgotPasswordRequestDto) {
    return this.accountAuth.requestPasswordResetCode(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password/verify')
  forgotPasswordVerify(@Body() dto: ForgotPasswordVerifyDto) {
    return this.accountAuth.verifyPasswordResetCode(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password/reset')
  forgotPasswordReset(@Body() dto: ForgotPasswordResetDto, @Ip() ip: string) {
    return this.accountAuth.resetPassword(dto, { ipAddress: ip });
  }
}
