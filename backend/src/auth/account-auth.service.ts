// backend/src/auth/account-auth.service.ts
// [11/10/2026] v1 — Inscription en étapes, connexion par numéro + mot de passe à 6 chiffres, mot de passe oublié (SMS ou e-mail).
//
//   Inscription : le téléphone est vérifié par un code SMS (le compte est alors connecté), puis l'e-mail — facultatif — par un code
//   reçu à cette adresse, puis le mot de passe à 6 chiffres est défini. Plus aucun SMS à la connexion : on ne dépense du crédit SMS
//   que pour vérifier un numéro et pour récupérer un mot de passe oublié.
//
//   Numéros de test (AUTH_TEST_PHONE_NUMBERS, mode test seulement) : aucun SMS, tous les codes valent 000000, et 000000 ouvre la
//   connexion par mot de passe. Ils ne subissent donc aucun changement de leur façon de se connecter.
//
// Les mécanismes de code (hash, expiration, essais comptés de façon atomique, usage unique) sont ceux de la connexion par SMS
// existante (AuthService) ; seul le but du code change (OtpPurpose).
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccountType, OtpPurpose, OtpStatus, Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService, SafeUser } from '../users/users.service';
import { DevicesService } from '../devices/devices.service';
import { SessionsService } from './sessions.service';
import { AuthResult, AuthService } from './auth.service';
import { SMS_PROVIDER, SmsProvider } from '../integrations/sms/sms-provider.interface';
import { EMAIL_PROVIDER, EmailProvider } from '../integrations/email/email-provider.interface';
import { OtpSettings, OtpSettingsService } from '../otp/otp-settings.service';
import { generateOtpCode, hashOtpCode, maskPhone, verifyOtpCode } from '../common/utils/otp.util';
import { maskEmail } from '../common/utils/mask.util';
import { addDuration } from '../common/utils/duration.util';
import { TEST_CODE, isTestPhone } from '../common/utils/test-mode.util';
import { isPinFormat, pinDigest, pinWeakness } from '../common/utils/pin.util';
import { DeviceInfoDto } from './dto/device-info.dto';

const DAY_MS = 24 * 3_600_000;

/** Erreurs de mot de passe de suite avant verrouillage, et durée du verrouillage. */
export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;

/** Durée de validité du jeton remis après un code de réinitialisation correct. */
const RESET_TOKEN_TTL = '10m';


const SMS_PURPOSES: OtpPurpose[] = [OtpPurpose.LOGIN, OtpPurpose.PHONE_VERIFICATION, OtpPurpose.PASSWORD_RESET];

type RequestContext = { ipAddress?: string; userAgent?: string };

const isCustomerOrDriver = (user: Pick<User, 'accountType'>) =>
  user.accountType === AccountType.CUSTOMER || user.accountType === AccountType.DRIVER;

const accountLabel = (type: AccountType) => (type === AccountType.DRIVER ? 'Conducteur' : 'Client');

@Injectable()
export class AccountAuthService {
  private readonly logger = new Logger(AccountAuthService.name);

  /** Empreinte factice, calculée une seule fois : un numéro inconnu prend autant de temps qu'un mot de passe faux (pas de sondage par le temps de réponse). */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly devicesService: DevicesService,
    private readonly sessionsService: SessionsService,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly otpSettings: OtpSettingsService,
  ) {}

  // ---------------------------------------------------------------------
  // Ancienne connexion par SMS : fermée pour les clients et conducteurs
  // ---------------------------------------------------------------------

  /**
   * L'ancien parcours « un SMS à chaque connexion » ne reste ouvert que pour :
   *  - les numéros de test (aucun SMS n'est envoyé) ;
   *  - tout le monde si AUTH_LEGACY_OTP_LOGIN=true (retour en arrière d'urgence, sans redéployer le code) — sauf l'équipe du
   *    back-office, qui ne reçoit jamais de SMS (AuthService.requestOtp la refuse).
   * L'équipe (Support, Superviseur, Finance, SuperAdmin) se connecte avec un code envoyé par e-mail. Un numéro inconnu est refusé :
   * plus aucun compte n'est créé par cette porte, l'inscription a la sienne.
   */
  async assertLegacyOtpAllowed(phone: string): Promise<void> {
    if (isTestPhone(phone) || process.env.AUTH_LEGACY_OTP_LOGIN === 'true') return;
    throw new BadRequestException(
      'La connexion par SMS n’est plus utilisée. Clients et conducteurs : connectez-vous avec votre numéro et votre mot de passe, ou créez votre compte. Équipe : demandez un code par e-mail.',
    );
  }

  // ---------------------------------------------------------------------
  // Inscription — étape 1 : le téléphone
  // ---------------------------------------------------------------------

  /**
   * Crée le compte (numéro non vérifié) et envoie tout de suite le code SMS. Un numéro dont l'inscription n'a pas été terminée
   * (pas encore de mot de passe) peut reprendre là où il s'était arrêté ; un numéro qui a déjà un mot de passe est refusé.
   */
  async requestSignupCode(dto: { phone: string; accountType: 'CUSTOMER' | 'DRIVER' }): Promise<{ expiresInSeconds: number }> {
    const test = isTestPhone(dto.phone);
    const settings = await this.otpSettings.get();
    if (!test) await this.assertSmsPlatformAllowed(dto.phone, settings);

    let user = await this.usersService.findByPhone(dto.phone);
    if (user) {
      if (!isCustomerOrDriver(user)) {
        throw new BadRequestException('Ce numéro ne peut pas être utilisé pour créer un compte.');
      }
      if (user.accountType !== dto.accountType) {
        throw new BadRequestException(
          `Ce numéro est déjà associé à un compte ${accountLabel(user.accountType)}. Utilisez un autre numéro pour créer un compte ${accountLabel(dto.accountType as AccountType)}, ou connectez-vous en tant que ${accountLabel(user.accountType).toLowerCase()}.`,
        );
      }
      if (user.passwordHash) {
        throw new BadRequestException('Ce numéro a déjà un compte. Connectez-vous avec votre mot de passe.');
      }
    } else {
      user = await this.createUserOrReuse(dto.phone, dto.accountType as AccountType);
    }
    if (user.isSuspended) throw new BadRequestException('Ce compte est suspendu.');

    return this.sendSmsCode(user, OtpPurpose.PHONE_VERIFICATION, 'votre code de vérification', settings, test);
  }

  /** Deux demandes simultanées pour le même nouveau numéro : la seconde retrouve le compte créé par la première. */
  private async createUserOrReuse(phone: string, accountType: AccountType): Promise<User> {
    try {
      return await this.usersService.createUser({ phone, accountType });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.usersService.findByPhone(phone);
        if (existing) return existing;
      }
      throw error;
    }
  }

  /** Inscription — étape 1 bis : le bon code prouve le numéro et connecte le compte, qui termine ensuite son inscription. */
  async verifySignupCode(
    dto: { phone: string; code: string; device?: DeviceInfoDto },
    context: RequestContext,
  ): Promise<AuthResult> {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user || !isCustomerOrDriver(user)) {
      throw new BadRequestException("Aucune demande de code n'a été faite pour ce numéro.");
    }
    if (user.passwordHash) {
      throw new BadRequestException('Ce numéro a déjà un compte. Connectez-vous avec votre mot de passe.');
    }
    if (user.isSuspended) throw new BadRequestException('Ce compte est suspendu.');

    await this.consumeCode(user.id, OtpPurpose.PHONE_VERIFICATION, dto.code);

    const verified = await this.prisma.user.update({
      where: { id: user.id },
      data: { isPhoneVerified: true, failedLoginAttempts: 0, lockedUntil: null },
    });

    const device = await this.devicesService.findOrCreateForLogin(verified.id, dto.device);
    const result = await this.authService.issueTokens(verified, {
      deviceId: device?.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    await this.usersService.updateLastLogin(verified.id);
    await this.audit.log({
      actorId: verified.id,
      entityType: 'User',
      entityId: verified.id,
      action: 'SIGNUP_PHONE_VERIFIED',
      ipAddress: context.ipAddress,
    });
    return result;
  }

  // ---------------------------------------------------------------------
  // Inscription — étape 2 : l'e-mail (facultatif), compte connecté
  // ---------------------------------------------------------------------

  async requestEmailCode(userId: string, rawEmail: string): Promise<{ expiresInSeconds: number }> {
    const email = rawEmail.trim().toLowerCase();
    const user = await this.requireUser(userId);

    const owner = await this.usersService.findByEmail(email);
    if (owner && owner.id !== user.id) {
      throw new ConflictException('Cette adresse e-mail est déjà utilisée par un autre compte.');
    }
    if (user.email === email && user.isEmailVerified) {
      throw new BadRequestException('Cette adresse e-mail est déjà vérifiée.');
    }

    const test = isTestPhone(user.phone);
    const settings = await this.otpSettings.get();
    if (!test) await this.assertCodeRequestAllowed(user.id, OtpPurpose.EMAIL_VERIFICATION, settings);

    const code = test ? TEST_CODE : generateOtpCode();
    const otp = await this.storeCode(user.id, OtpPurpose.EMAIL_VERIFICATION, code, settings, email);

    if (test) {
      this.logger.warn(`[MODE TEST] Code e-mail fixe pour ${maskPhone(user.phone)} : ${TEST_CODE} — aucun e-mail envoyé.`);
    } else {
      try {
        await this.emailProvider.send(
          email,
          'Vérifiez votre adresse e-mail Occa’Z',
          `Votre code de vérification est ${code}. Il expire dans ${Math.round(settings.expirySeconds / 60)} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
        );
      } catch (error) {
        await this.prisma.otpCode.delete({ where: { id: otp.id } }).catch(() => undefined);
        this.logger.error(`E-mail de vérification non envoyé à ${maskEmail(email)} : ${(error as Error).message}`);
        throw new ServiceUnavailableException("L'e-mail n'a pas pu être envoyé. Vérifiez l'adresse puis réessayez.");
      }
    }
    return { expiresInSeconds: settings.expirySeconds };
  }

  async verifyEmailCode(userId: string, rawEmail: string, code: string): Promise<SafeUser> {
    const email = rawEmail.trim().toLowerCase();
    await this.requireUser(userId);
    await this.consumeCode(userId, OtpPurpose.EMAIL_VERIFICATION, code, email);

    try {
      await this.prisma.user.update({ where: { id: userId }, data: { email, isEmailVerified: true } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cette adresse e-mail est déjà utilisée par un autre compte.');
      }
      throw error;
    }
    await this.audit.log({ actorId: userId, entityType: 'User', entityId: userId, action: 'EMAIL_VERIFIED' });
    return this.usersService.getSafeById(userId);
  }

  // ---------------------------------------------------------------------
  // Inscription — étape 3 : le mot de passe à 6 chiffres
  // ---------------------------------------------------------------------

  /** Première définition du mot de passe (compte connecté, sans mot de passe). Pour le modifier ensuite : « Mot de passe oublié ». */
  async setPassword(userId: string, password: string): Promise<SafeUser> {
    const user = await this.requireUser(userId);
    if (!isCustomerOrDriver(user)) {
      throw new BadRequestException("Ce type de compte n'utilise pas de mot de passe à 6 chiffres.");
    }
    if (user.passwordHash) {
      throw new BadRequestException('Un mot de passe est déjà défini. Utilisez « Mot de passe oublié » pour le modifier.');
    }
    this.assertPinAcceptable(password, user.phone);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.hashPin(password), failedLoginAttempts: 0, lockedUntil: null },
    });
    await this.audit.log({ actorId: userId, entityType: 'User', entityId: userId, action: 'PASSWORD_SET' });
    return this.usersService.getSafeById(userId);
  }

  /**
   * Changement du mot de passe par une personne connectée : il faut connaître l'actuel. Les erreurs comptent dans le même verrouillage
   * que la connexion (un téléphone volé et déverrouillé ne permet pas d'essayer les 1 000 000 de combinaisons). Les autres appareils
   * sont déconnectés ; celui qui vient de changer le mot de passe reste connecté.
   */
  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string },
    context: RequestContext & { sessionId?: string },
  ): Promise<{ message: string }> {
    const user = await this.requireUser(userId);
    if (!isCustomerOrDriver(user)) {
      throw new BadRequestException("Ce type de compte n'utilise pas de mot de passe à 6 chiffres.");
    }
    if (!user.passwordHash) {
      throw new BadRequestException("Aucun mot de passe n'est encore défini : choisissez-en un d'abord.");
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) throw this.lockedError(user.lockedUntil);

    const testBypass = isTestPhone(user.phone) && dto.currentPassword === TEST_CODE;
    if (!testBypass) {
      const valid = await bcrypt.compare(pinDigest(dto.currentPassword), user.passwordHash);
      if (!valid) {
        const lockedUntil = await this.registerFailedAttempt(user.id);
        if (lockedUntil) throw this.lockedError(lockedUntil);
        throw new BadRequestException('Mot de passe actuel incorrect.');
      }
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel.");
    }
    this.assertPinAcceptable(dto.newPassword, user.phone);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.hashPin(dto.newPassword), failedLoginAttempts: 0, lockedUntil: null },
    });
    if (context.sessionId) await this.sessionsService.revokeOthersForUser(user.id, context.sessionId);
    else await this.sessionsService.revokeAllForUser(user.id);
    await this.audit.log({
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'PASSWORD_CHANGED',
      ipAddress: context.ipAddress,
    });
    return { message: 'Mot de passe modifié.' };
  }

  // ---------------------------------------------------------------------
  // Connexion : numéro + mot de passe
  // ---------------------------------------------------------------------

  async loginWithPhone(
    dto: { phone: string; password: string; expectedAccountType?: 'CUSTOMER' | 'DRIVER'; device?: DeviceInfoDto },
    context: RequestContext,
  ): Promise<AuthResult> {
    const wrong = () => new UnauthorizedException('Numéro ou mot de passe incorrect.');

    const user = await this.usersService.findByPhone(dto.phone);
    if (!user || !isCustomerOrDriver(user)) {
      this.dummyHash ??= bcrypt.hash('occaz-dummy', 12);
      await bcrypt.compare(pinDigest(dto.password), await this.dummyHash).catch(() => false);
      throw wrong();
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw this.lockedError(user.lockedUntil);
    }

    const testBypass = isTestPhone(user.phone) && dto.password === TEST_CODE;
    if (testBypass) {
      this.logger.warn(
        `[MODE TEST] Connexion de ${maskPhone(user.phone)} avec le code fixe ${TEST_CODE} — ne jamais laisser AUTH_TEST_MODE_ENABLED=true en production réelle.`,
      );
    } else {
      if (!user.passwordHash) {
        throw new UnauthorizedException(
          "Aucun mot de passe n'est encore défini pour ce compte. Utilisez « Mot de passe oublié » pour en créer un.",
        );
      }
      const valid = await bcrypt.compare(pinDigest(dto.password), user.passwordHash);
      if (!valid) {
        const lockedUntil = await this.registerFailedAttempt(user.id);
        if (lockedUntil) throw this.lockedError(lockedUntil);
        throw wrong();
      }
    }

    if (user.isSuspended) throw new UnauthorizedException('Ce compte est suspendu.');
    if (dto.expectedAccountType && dto.expectedAccountType !== user.accountType) {
      const existing = accountLabel(user.accountType);
      throw new BadRequestException(
        `Ce numéro est associé à un compte ${existing}. Appuyez sur « Je suis ${existing.toLowerCase()} » pour vous connecter.`,
      );
    }

    const fresh =
      user.failedLoginAttempts > 0 || user.lockedUntil
        ? await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } })
        : user;

    const device = await this.devicesService.findOrCreateForLogin(fresh.id, dto.device);
    const result = await this.authService.issueTokens(fresh, {
      deviceId: device?.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    await this.usersService.updateLastLogin(fresh.id);
    await this.audit.log({
      actorId: fresh.id,
      entityType: 'User',
      entityId: fresh.id,
      action: 'LOGIN_PHONE_PASSWORD',
      ipAddress: context.ipAddress,
    });
    return result;
  }

  /** Compte une erreur ; à la {MAX_LOGIN_FAILURES}e de suite, verrouille le compte et renvoie la fin du verrouillage. */
  private async registerFailedAttempt(userId: string): Promise<Date | null> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    if (updated.failedLoginAttempts < MAX_LOGIN_FAILURES) return null;

    const lockedUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000);
    await this.prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil } });
    await this.audit.log({ actorId: userId, entityType: 'User', entityId: userId, action: 'LOGIN_LOCKED' });
    return lockedUntil;
  }

  private lockedError(lockedUntil: Date): HttpException {
    const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
    return new HttpException(
      `Trop d'essais. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}, ou utilisez « Mot de passe oublié ».`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // ---------------------------------------------------------------------
  // Mot de passe oublié : code par SMS ou par e-mail, puis nouveau mot de passe
  // ---------------------------------------------------------------------

  /**
   * Ne révèle pas si un numéro est inscrit : la réponse a toujours la même forme et aucun SMS ne part pour un numéro inconnu.
   * Seule exception utile : demander l'e-mail quand le compte n'a pas d'adresse vérifiée est expliqué, pour que la personne
   * choisisse le SMS au lieu d'attendre un e-mail qui n'arrivera pas.
   */
  async requestPasswordResetCode(dto: {
    phone: string;
    channel: 'SMS' | 'EMAIL';
  }): Promise<{ expiresInSeconds: number; destination: string }> {
    const test = isTestPhone(dto.phone);
    const settings = await this.otpSettings.get();
    if (!test) this.otpSettings.assertPhoneAllowed(dto.phone, settings);

    const user = await this.usersService.findByPhone(dto.phone);
    const eligible = Boolean(user && isCustomerOrDriver(user) && !user.isSuspended);
    const placeholder = {
      expiresInSeconds: settings.expirySeconds,
      destination: dto.channel === 'SMS' ? maskPhone(dto.phone) : 'votre adresse e-mail',
    };
    if (!user || !eligible) return placeholder;

    if (dto.channel === 'SMS') {
      if (!test) await this.assertSmsPlatformAllowed(dto.phone, settings);
      const { expiresInSeconds } = await this.sendSmsCode(user, OtpPurpose.PASSWORD_RESET, 'votre code pour changer de mot de passe', settings, test);
      return { expiresInSeconds, destination: maskPhone(user.phone) };
    }

    if (!user.email || !user.isEmailVerified) {
      throw new BadRequestException("Aucune adresse e-mail vérifiée n'est enregistrée sur ce compte. Choisissez l'envoi par SMS.");
    }
    if (!test) await this.assertCodeRequestAllowed(user.id, OtpPurpose.PASSWORD_RESET, settings);
    const code = test ? TEST_CODE : generateOtpCode();
    const otp = await this.storeCode(user.id, OtpPurpose.PASSWORD_RESET, code, settings);
    if (test) {
      this.logger.warn(`[MODE TEST] Code e-mail fixe pour ${maskPhone(user.phone)} : ${TEST_CODE} — aucun e-mail envoyé.`);
    } else {
      try {
        await this.emailProvider.send(
          user.email,
          'Changer votre mot de passe Occa’Z',
          `Votre code pour changer de mot de passe est ${code}. Il expire dans ${Math.round(settings.expirySeconds / 60)} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe actuel reste valable.`,
        );
      } catch (error) {
        await this.prisma.otpCode.delete({ where: { id: otp.id } }).catch(() => undefined);
        this.logger.error(`E-mail de réinitialisation non envoyé à ${maskEmail(user.email)} : ${(error as Error).message}`);
        throw new ServiceUnavailableException("L'e-mail n'a pas pu être envoyé. Réessayez dans un instant ou choisissez le SMS.");
      }
    }
    return { expiresInSeconds: settings.expirySeconds, destination: maskEmail(user.email) };
  }

  /** Vérifie le code et remet un jeton court, à usage unique, qui autorise de choisir le nouveau mot de passe. */
  async verifyPasswordResetCode(dto: { phone: string; code: string }): Promise<{ resetToken: string }> {
    const user = await this.usersService.findByPhone(dto.phone);
    if (!user || !isCustomerOrDriver(user)) throw new UnauthorizedException('Code invalide.');

    await this.consumeCode(user.id, OtpPurpose.PASSWORD_RESET, dto.code);

    const resetToken = this.jwtService.sign(
      { sub: user.id, purpose: 'password-reset', ver: this.passwordFingerprint(user.passwordHash) },
      { secret: this.resetSecret(), expiresIn: RESET_TOKEN_TTL },
    );
    return { resetToken };
  }

  async resetPassword(dto: { resetToken: string; newPassword: string }, context: RequestContext): Promise<{ message: string }> {
    const expired = () => new UnauthorizedException('Cette étape a expiré. Recommencez depuis « Mot de passe oublié ».');

    let payload: { sub: string; purpose: string; ver: string };
    try {
      payload = this.jwtService.verify(dto.resetToken, { secret: this.resetSecret() });
    } catch {
      throw expired();
    }
    if (payload.purpose !== 'password-reset') throw expired();

    const user = await this.usersService.findById(payload.sub);
    // L'empreinte du mot de passe actuel est dans le jeton : une fois le mot de passe changé, le jeton ne vaut plus rien.
    if (!user || !isCustomerOrDriver(user) || payload.ver !== this.passwordFingerprint(user.passwordHash)) throw expired();

    this.assertPinAcceptable(dto.newPassword, user.phone);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.hashPin(dto.newPassword), failedLoginAttempts: 0, lockedUntil: null },
    });
    // Un mot de passe oublié peut être un mot de passe découvert : toutes les sessions ouvertes sont coupées.
    await this.sessionsService.revokeAllForUser(user.id);
    await this.audit.log({
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'PASSWORD_RESET_PHONE',
      ipAddress: context.ipAddress,
    });
    return { message: 'Mot de passe modifié. Connectez-vous avec votre nouveau mot de passe.' };
  }

  // ---------------------------------------------------------------------
  // Codes à usage unique
  // ---------------------------------------------------------------------

  /** Plafonds de la plateforme pour les SMS : indicatif autorisé, et nombre de codes par jour pour toute la plateforme. */
  private async assertSmsPlatformAllowed(phone: string, settings: OtpSettings): Promise<void> {
    this.otpSettings.assertPhoneAllowed(phone, settings);
    if (settings.dailyLimitGlobal <= 0) return;
    const today = await this.prisma.otpCode.count({
      where: { purpose: { in: SMS_PURPOSES }, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
    });
    if (today >= settings.dailyLimitGlobal) {
      this.logger.error(
        `Plafond quotidien de codes SMS atteint (${settings.dailyLimitGlobal}) : nouvelles demandes refusées. Vérifiez l'activité, puis relevez le plafond dans Paramètres → Connexion et SMS si elle est légitime.`,
      );
      throw new ServiceUnavailableException('Le service de SMS est momentanément saturé. Réessayez dans quelques heures.');
    }
  }

  /** Au plus `requestLimit` codes par fenêtre et `dailyLimitPerPhone` par jour, pour un même compte et un même but. */
  private async assertCodeRequestAllowed(userId: string, purpose: OtpPurpose, settings: OtpSettings): Promise<void> {
    const now = Date.now();
    const base = { userId, purpose };
    const [recent, today] = await Promise.all([
      this.prisma.otpCode.count({ where: { ...base, createdAt: { gte: new Date(now - settings.requestWindowMinutes * 60_000) } } }),
      settings.dailyLimitPerPhone > 0
        ? this.prisma.otpCode.count({ where: { ...base, createdAt: { gte: new Date(now - DAY_MS) } } })
        : Promise.resolve(0),
    ]);
    if (recent >= settings.requestLimit) {
      throw new HttpException(
        `Trop de demandes de code. Patientez ${settings.requestWindowMinutes} minutes avant de réessayer.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (settings.dailyLimitPerPhone > 0 && today >= settings.dailyLimitPerPhone) {
      throw new HttpException(
        'Trop de codes demandés aujourd’hui. Réessayez demain ou contactez le support.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Enregistre un nouveau code ; les codes précédents du même but deviennent inutilisables (un seul code valable à la fois). */
  private async storeCode(userId: string, purpose: OtpPurpose, code: string, settings: OtpSettings, target?: string) {
    await this.prisma.otpCode.updateMany({
      where: { userId, purpose, status: OtpStatus.PENDING },
      data: { status: OtpStatus.EXPIRED },
    });
    return this.prisma.otpCode.create({
      data: {
        userId,
        purpose,
        target,
        code: hashOtpCode(code),
        status: OtpStatus.PENDING,
        maxAttempts: settings.maxAttempts,
        expiresAt: addDuration(`${settings.expirySeconds}s`),
      },
    });
  }

  /** Code par SMS : contrôles, enregistrement, envoi (ou code fixe pour un numéro de test). Un SMS non parti n'est pas compté. */
  private async sendSmsCode(
    user: User,
    purpose: OtpPurpose,
    wording: string,
    settings: OtpSettings,
    test: boolean,
  ): Promise<{ expiresInSeconds: number }> {
    if (!test) await this.assertCodeRequestAllowed(user.id, purpose, settings);

    const code = test ? TEST_CODE : generateOtpCode();
    const otp = await this.storeCode(user.id, purpose, code, settings);

    if (test) {
      this.logger.warn(
        `[MODE TEST] Code fixe pour ${maskPhone(user.phone)} : ${TEST_CODE} — aucun SMS envoyé. Ne jamais laisser AUTH_TEST_MODE_ENABLED=true en production réelle.`,
      );
    } else {
      try {
        // Le code en tête et le mot « code » : c'est ce que reconnaissent iOS et le clavier Android pour proposer la saisie automatique.
        await this.smsProvider.send(
          user.phone,
          `Occa'Z : ${code} est ${wording}. Valable ${Math.round(settings.expirySeconds / 60)} min. Ne le communiquez à personne.`,
        );
      } catch (error) {
        await this.prisma.otpCode.delete({ where: { id: otp.id } }).catch(() => undefined);
        this.logger.error(`SMS non envoyé vers ${maskPhone(user.phone)} : ${(error as Error).message}`);
        throw new ServiceUnavailableException("Le SMS n'a pas pu être envoyé. Réessayez dans un instant.");
      }
    }
    return { expiresInSeconds: settings.expirySeconds };
  }

  /**
   * Vérifie un code puis le consomme, une seule fois. L'essai est compté AVANT la comparaison, en une opération atomique : des
   * requêtes envoyées en parallèle ne peuvent pas dépasser le nombre d'essais autorisés.
   */
  private async consumeCode(userId: string, purpose: OtpPurpose, code: string, target?: string): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { userId, purpose, status: OtpStatus.PENDING, ...(target ? { target } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException('Code expiré ou introuvable, veuillez en redemander un.');
    }
    if (otp.attempts >= otp.maxAttempts) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { status: OtpStatus.FAILED } });
      throw new UnauthorizedException('Trop de tentatives, veuillez redemander un code.');
    }
    const claimed = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, status: OtpStatus.PENDING, attempts: { lt: otp.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) throw new UnauthorizedException('Trop de tentatives, veuillez redemander un code.');

    if (!verifyOtpCode(code, otp.code)) throw new UnauthorizedException('Code invalide.');

    const consumed = await this.prisma.otpCode.updateMany({
      where: { id: otp.id, status: OtpStatus.PENDING },
      data: { status: OtpStatus.VERIFIED, verifiedAt: new Date() },
    });
    if (consumed.count === 0) throw new UnauthorizedException('Ce code a déjà été utilisé, veuillez en redemander un.');
  }

  // ---------------------------------------------------------------------
  // Aides
  // ---------------------------------------------------------------------

  private async requireUser(userId: string): Promise<User> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Utilisateur introuvable.');
    return user;
  }

  /** Format (6 chiffres) puis facilité à deviner ; les numéros de test, eux, acceptent n'importe quel code à 6 chiffres. */
  private assertPinAcceptable(pin: string, phone: string): void {
    if (!isPinFormat(pin)) throw new BadRequestException('Le mot de passe doit contenir exactement 6 chiffres.');
    if (isTestPhone(phone)) return;
    const weakness = pinWeakness(pin);
    if (weakness) throw new BadRequestException(weakness);
  }

  private hashPin(pin: string): Promise<string> {
    return bcrypt.hash(pinDigest(pin), 12);
  }

  private resetSecret(): string {
    // Secret distinct de celui des jetons d'accès : un jeton de réinitialisation n'ouvre jamais une session.
    return `${this.configService.get<string>('jwt.accessSecret')!}:password-reset`;
  }

  private passwordFingerprint(passwordHash: string | null): string {
    return createHash('sha256').update(passwordHash ?? 'none').digest('hex').slice(0, 16);
  }
}
