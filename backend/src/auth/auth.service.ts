// backend/src/auth/auth.service.ts
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccountType, OtpPurpose, OtpStatus, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService, SafeUser } from '../users/users.service';
import { DevicesService } from '../devices/devices.service';
import { SessionsService } from './sessions.service';
import { TwoFactorService } from './two-factor.service';
import { SMS_PROVIDER, SmsProvider } from '../integrations/sms/sms-provider.interface';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '../common/utils/otp.util';
import { addDuration } from '../common/utils/duration.util';
import { JwtAccessPayload, JwtRefreshPayload } from '../common/types/jwt-payload.interface';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginPasswordDto } from './dto/login-password.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult extends AuthTokens {
  user: SafeUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly devicesService: DevicesService,
    private readonly sessionsService: SessionsService,
    private readonly twoFactorService: TwoFactorService,
    private readonly audit: AuditService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  // ---------------------------------------------------------------------
  // OTP par téléphone — parcours principal Client / Chauffeur (section 36)
  // ---------------------------------------------------------------------

  /**
   * Le compte User est créé dès la demande d'OTP (avec isPhoneVerified à
   * false) plutôt qu'à la confirmation : cela évite d'avoir besoin d'un
   * champ `phone` séparé sur OtpCode, l'OTP est directement rattaché au
   * userId. Si le compte existe déjà, `signupAccountType` est ignoré.
   */
  async requestOtp(dto: RequestOtpDto): Promise<{ expiresInSeconds: number }> {
    let user = await this.usersService.findByPhone(dto.phone);

    if (!user) {
      user = await this.usersService.createUser({
        phone: dto.phone,
        accountType: dto.signupAccountType ?? AccountType.CUSTOMER,
      });
    }

    if (user.isSuspended) {
      throw new BadRequestException('Ce compte est suspendu.');
    }

    const expirySeconds = this.configService.get<number>('otp.expirySeconds')!;
    const maxAttempts = this.configService.get<number>('otp.maxAttempts')!;
    const code = generateOtpCode();

    await this.prisma.otpCode.create({
      data: {
        userId: user.id,
        code: hashOtpCode(code),
        purpose: OtpPurpose.LOGIN,
        status: OtpStatus.PENDING,
        maxAttempts,
        expiresAt: addDuration(`${expirySeconds}s`),
      },
    });

    await this.smsProvider.send(
      dto.phone,
      `Votre code de connexion est ${code}. Il expire dans ${Math.round(expirySeconds / 60)} minutes.`,
    );

    return { expiresInSeconds: expirySeconds };
  }

  async verifyOtpAndLogin(
    dto: VerifyOtpDto,
    context: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResult> {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user) {
      throw new BadRequestException("Aucune demande de code n'a été faite pour ce numéro.");
    }

    const otp = await this.prisma.otpCode.findFirst({
      where: { userId: user.id, purpose: OtpPurpose.LOGIN, status: OtpStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException('Code expiré ou introuvable, veuillez en redemander un.');
    }
    if (otp.attempts >= otp.maxAttempts) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { status: OtpStatus.FAILED },
      });
      throw new UnauthorizedException('Trop de tentatives, veuillez redemander un code.');
    }

    if (!verifyOtpCode(dto.code, otp.code)) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Code invalide.');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { status: OtpStatus.VERIFIED, verifiedAt: new Date() },
    });

    if (!user.isPhoneVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isPhoneVerified: true },
      });
    }

    const device = await this.devicesService.findOrCreateForLogin(user.id, dto.device);
    const result = await this.issueTokens(user, {
      deviceId: device?.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await this.usersService.updateLastLogin(user.id);
    await this.audit.log({
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'LOGIN_OTP',
      ipAddress: context.ipAddress,
    });

    return result;
  }

  // ---------------------------------------------------------------------
  // Email + mot de passe — réservé à SUPPORT / SUPERADMIN (section 36)
  // ---------------------------------------------------------------------

  async loginWithPassword(
    dto: LoginPasswordDto,
    context: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (
      !user ||
      !user.passwordHash ||
      (user.accountType !== AccountType.SUPPORT && user.accountType !== AccountType.SUPERADMIN)
    ) {
      throw new UnauthorizedException('Identifiants invalides.');
    }
    if (user.isSuspended) {
      throw new UnauthorizedException('Ce compte est suspendu.');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Identifiants invalides.');
    }

    if (user.isTwoFactorEnabled) {
      if (!dto.twoFactorCode) {
        throw new UnauthorizedException('Code 2FA requis.');
      }
      if (!user.twoFactorSecret || !this.twoFactorService.verify(dto.twoFactorCode, user.twoFactorSecret)) {
        throw new UnauthorizedException('Code 2FA invalide.');
      }
    } else if (user.accountType === AccountType.SUPERADMIN) {
      // La 2FA est obligatoire pour le SuperAdmin (section 3.1) — un compte
      // qui ne l'a pas encore configurée doit d'abord passer par
      // /auth/2fa/setup avant de pouvoir se connecter normalement.
      throw new UnauthorizedException(
        "La double authentification n'est pas encore configurée sur ce compte SuperAdmin.",
      );
    }

    const device = await this.devicesService.findOrCreateForLogin(user.id, dto.device);
    const result = await this.issueTokens(user, {
      deviceId: device?.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    await this.usersService.updateLastLogin(user.id);
    await this.audit.log({
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'LOGIN_PASSWORD',
      ipAddress: context.ipAddress,
    });

    return result;
  }

  // ---------------------------------------------------------------------
  // 2FA — setup / activation
  // ---------------------------------------------------------------------

  async setupTwoFactor(userId: string): Promise<{ secret: string; otpAuthUri: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Utilisateur introuvable.');

    const secret = this.twoFactorService.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret, isTwoFactorEnabled: false },
    });

    return {
      secret,
      otpAuthUri: this.twoFactorService.getOtpAuthUri(secret, user.email ?? user.phone),
    };
  }

  async enableTwoFactor(userId: string, code: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user?.twoFactorSecret) {
      throw new BadRequestException("Aucun secret 2FA en attente — appelez d'abord /auth/2fa/setup.");
    }
    if (!this.twoFactorService.verify(code, user.twoFactorSecret)) {
      throw new UnauthorizedException('Code invalide.');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true },
    });
    await this.audit.log({
      actorId: userId,
      entityType: 'User',
      entityId: userId,
      action: 'TWO_FACTOR_ENABLED',
    });
  }

  // ---------------------------------------------------------------------
  // Rafraîchissement / déconnexion
  // ---------------------------------------------------------------------

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret')!,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    const session = await this.sessionsService.validateRefreshToken(
      payload.sessionId,
      refreshToken,
    );

    const user = await this.usersService.findById(session.userId);
    if (!user || !user.isActive || user.isSuspended) {
      throw new UnauthorizedException('Compte introuvable, désactivé ou suspendu.');
    }

    return this.signTokenPair(user, session.id, true);
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionsService.revoke(sessionId);
  }

  /** Déconnexion de toutes les sessions — exigence SuperAdmin (section 3.1). */
  async logoutAll(userId: string): Promise<void> {
    await this.sessionsService.revokeAllForUser(userId);
    await this.audit.log({
      actorId: userId,
      entityType: 'User',
      entityId: userId,
      action: 'LOGOUT_ALL_SESSIONS',
    });
  }

  // ---------------------------------------------------------------------
  // Interne
  // ---------------------------------------------------------------------

  private async issueTokens(
    user: User,
    params: { deviceId?: string | null; ipAddress?: string; userAgent?: string },
  ): Promise<AuthResult> {
    const sessionId = uuidv4();
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn')!;

    const tokens = this.signTokenPairRaw(user, sessionId);

    await this.sessionsService.create({
      id: sessionId,
      userId: user.id,
      deviceId: params.deviceId ?? undefined,
      refreshToken: tokens.refreshToken,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      expiresAt: addDuration(refreshExpiresIn),
    });

    return { ...tokens, user: this.usersService.toSafeUser(user) };
  }

  /** Rotation : émet une nouvelle paire de tokens pour une session existante. */
  private async signTokenPair(
    user: User,
    sessionId: string,
    rotate: boolean,
  ): Promise<AuthTokens> {
    const tokens = this.signTokenPairRaw(user, sessionId);
    if (rotate) {
      const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn')!;
      await this.sessionsService.rotateRefreshToken(
        sessionId,
        tokens.refreshToken,
        addDuration(refreshExpiresIn),
      );
    }
    return tokens;
  }

  private signTokenPairRaw(user: User, sessionId: string): AuthTokens {
    const accessExpiresIn = this.configService.get<string>('jwt.accessExpiresIn')!;
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn')!;

    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      accountType: user.accountType,
      sessionId,
    };
    const refreshPayload: JwtRefreshPayload = { sub: user.id, sessionId };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get<string>('jwt.accessSecret')!,
      expiresIn: accessExpiresIn,
    });
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret')!,
      expiresIn: refreshExpiresIn,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(
        (addDuration(accessExpiresIn).getTime() - Date.now()) / 1000,
      ),
    };
  }
}
