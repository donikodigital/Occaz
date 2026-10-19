// backend/src/auth/phone-change.service.ts
// [19/10/2026] v3 — Qui reçoit quoi :
//   • Client et Conducteur : le code part TOUJOURS par SMS au NOUVEAU numéro (motif PHONE_CHANGE, ouvert par défaut) ;
//   • Support et SuperAdmin (l'équipe) : aucun SMS, le code part par e-mail à l'adresse du compte (gratuit). Un compte d'équipe sans
//     adresse e-mail ne peut pas changer de numéro tant qu'il n'en a pas une ;
//   • l'alerte « votre numéro a été remplacé » part par e-mail (si le compte en a une) ; le SMS à l'ancien numéro (motif
//     PHONE_CHANGE_ALERT) reste fermé par défaut : SMS_EXTRA_PURPOSES=PHONE_CHANGE_ALERT le rouvre.
// La réponse de l'étape 1 indique le canal utilisé (SMS ou EMAIL) et la destination masquée, pour que l'écran dise où regarder.
//
// Changement de numéro de téléphone. Le numéro est l'identifiant de connexion d'un Client ou d'un Conducteur : on ne l'adopte qu'une
// fois prouvé que la personne possède le NOUVEAU numéro, en lui envoyant un code par SMS. Pour l'équipe, la preuve est l'e-mail du compte.
//
// Garde-fous :
//  - le code est lié au numéro auquel il a été envoyé (table PhoneChangeRequest) : un code reçu sur le numéro A ne valide jamais B ;
//  - le nouveau numéro ne doit appartenir à aucun autre compte (un numéro = un compte) ;
//  - limites d'envoi par compte ET par numéro destinataire : un script ne peut pas inonder de SMS le numéro de quelqu'un d'autre ;
//  - 3 essais par code ; un nouveau code annule le précédent ;
//  - délai entre deux changements (30 jours par défaut, 0 pour désactiver) et limites d'envoi : réglables dans l'administration
//    (Paramètres → Connexion et SMS), avec repli sur les variables d'environnement (PHONE_CHANGE_COOLDOWN_DAYS, OTP_REQUEST_LIMIT…) ;
//  - seuls les indicatifs autorisés (liste réglable dans l'administration) peuvent recevoir un code ;
//  - la personne est prévenue du changement (e-mail, ou SMS à l'ancien numéro si ce motif est rouvert) : si ce n'est pas elle (session volée), elle le sait aussitôt ;
//  - chaque changement est journalisé (audit), avec l'ancien et le nouveau numéro.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AccountType, OtpStatus, Prisma, ShipmentStatus, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService, SafeUser } from '../users/users.service';
import { SMS_PROVIDER, SmsProvider } from '../integrations/sms/sms-provider.interface';
import { EMAIL_PROVIDER, EmailProvider } from '../integrations/email/email-provider.interface';
import { isSmsPurposeAllowed, SmsPurpose } from '../integrations/sms/sms-purpose';
import { maskEmail } from '../common/utils/mask.util';
import { generateOtpCode, hashOtpCode, maskPhone, verifyOtpCode } from '../common/utils/otp.util';
import { OtpSettings, OtpSettingsService } from '../otp/otp-settings.service';
import { addDuration } from '../common/utils/duration.util';

const DAY_MS = 24 * 3_600_000;
const TEST_CODE = '000000';

/** Envois dont le code de récupération part encore vers le téléphone de l'expéditeur : leur numéro suit le compte. */
const SHIPMENTS_FOLLOWING_SENDER_PHONE: ShipmentStatus[] = [
  ShipmentStatus.SEARCHING_DRIVER,
  ShipmentStatus.DRIVER_ASSIGNED,
  ShipmentStatus.PICKUP_PENDING,
];

@Injectable()
export class PhoneChangeService {
  private readonly logger = new Logger(PhoneChangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpSettings: OtpSettingsService,
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  /** L'équipe (Support, SuperAdmin) n'a jamais de SMS : son code part par e-mail. */
  private isStaff(user: Pick<User, 'accountType'>): boolean {
    return user.accountType === AccountType.SUPPORT || user.accountType === AccountType.SUPERADMIN;
  }

  /** Même mode test que la connexion de l'équipe : seules les adresses listées dans AUTH_TEST_STAFF_EMAILS, jamais en production réelle. */
  private isTestStaffEmail(email: string): boolean {
    if (process.env.AUTH_TEST_MODE_ENABLED !== 'true') return false;
    return (process.env.AUTH_TEST_STAFF_EMAILS ?? '')
      .split(',')
      .map((candidate) => candidate.trim().toLowerCase())
      .includes(email.trim().toLowerCase());
  }

  /** Même mode test que la connexion : seuls les numéros listés dans AUTH_TEST_PHONE_NUMBERS, et jamais en production réelle. */
  private isTestPhone(phone: string): boolean {
    if (process.env.AUTH_TEST_MODE_ENABLED !== 'true') return false;
    return (process.env.AUTH_TEST_PHONE_NUMBERS ?? '')
      .split(',')
      .map((candidate) => candidate.trim())
      .includes(phone);
  }

  /**
   * Étape 1 : vérifie que le changement est possible, puis envoie le code — par SMS au NOUVEAU numéro (Client, Conducteur) ou par
   * e-mail à l'adresse du compte (Support, SuperAdmin).
   */
  async request(
    userId: string,
    newPhone: string,
  ): Promise<{ expiresInSeconds: number; channel: 'SMS' | 'EMAIL'; destination: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Compte introuvable.');
    if (user.isSuspended) throw new BadRequestException('Ce compte est suspendu.');
    if (newPhone === user.phone) throw new BadRequestException("C'est déjà le numéro de votre compte.");

    const staff = this.isStaff(user);
    if (!staff && user.accountType !== AccountType.CUSTOMER && user.accountType !== AccountType.DRIVER) {
      throw new ForbiddenException('Ce type de compte ne peut pas changer de numéro.');
    }
    if (staff && !user.email) {
      throw new BadRequestException("Ajoutez d'abord une adresse e-mail à votre compte : le code de confirmation y est envoyé.");
    }

    const owner = await this.usersService.findByPhone(newPhone);
    if (owner) throw new ConflictException('Ce numéro est déjà utilisé par un autre compte.');

    const settings = await this.otpSettings.get();
    if (!staff) await this.assertCooldownOver(userId, settings.phoneChangeCooldownDays);

    const isTest = staff ? this.isTestStaffEmail(user.email as string) : this.isTestPhone(newPhone);
    if (!isTest) {
      // Le SMS coûte cher : seuls les indicatifs autorisés peuvent recevoir un code. L'équipe n'est pas concernée (e-mail gratuit).
      if (!staff) this.otpSettings.assertPhoneAllowed(newPhone, settings);
      await this.assertRequestAllowed(userId, newPhone, settings);
    }

    const { expirySeconds, maxAttempts } = settings;
    const code = isTest ? TEST_CODE : generateOtpCode();

    // Un nouveau code annule le précédent : un seul code valable à la fois.
    await this.prisma.phoneChangeRequest.updateMany({
      where: { userId, status: OtpStatus.PENDING },
      data: { status: OtpStatus.EXPIRED },
    });
    const created = await this.prisma.phoneChangeRequest.create({
      data: {
        userId,
        oldPhone: user.phone,
        newPhone,
        codeHash: hashOtpCode(code),
        maxAttempts,
        expiresAt: addDuration(`${expirySeconds}s`),
      },
    });

    const channel = staff ? 'EMAIL' : 'SMS';
    const destination = staff ? maskEmail(user.email as string) : maskPhone(newPhone);
    const minutes = Math.round(expirySeconds / 60);

    if (isTest) {
      this.logger.warn(`[MODE TEST] Changement de numéro vers ${newPhone} : code fixe ${TEST_CODE}, rien n'est envoyé.`);
      return { expiresInSeconds: expirySeconds, channel, destination };
    }

    try {
      if (staff) {
        await this.emailProvider.send(
          user.email as string,
          'Votre code pour changer de numéro Occa’Z',
          `Votre code pour remplacer le numéro de votre compte par ${maskPhone(newPhone)} est ${code}. Il expire dans ${minutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail et prévenez un administrateur.`,
        );
      } else {
        await this.smsProvider.send(
          newPhone,
          `Occa'Z : votre code pour changer de numéro est ${code}. Il expire dans ${minutes} minutes. Ne le communiquez à personne.`,
          SmsPurpose.PHONE_CHANGE,
        );
      }
    } catch (error) {
      await this.prisma.phoneChangeRequest.update({ where: { id: created.id }, data: { status: OtpStatus.FAILED } });
      this.logger.error(`Code de changement de numéro non envoyé (${channel}) vers ${destination} : ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        staff ? "L'e-mail n'a pas pu être envoyé. Réessayez dans un instant." : "Le SMS n'a pas pu être envoyé. Réessayez dans un instant.",
      );
    }

    return { expiresInSeconds: expirySeconds, channel, destination };
  }

  /** Étape 2 : le code saisi est le bon → le compte prend le nouveau numéro. Renvoie le compte à jour. */
  async confirm(
    userId: string,
    newPhone: string,
    code: string,
    context: { ipAddress?: string } = {},
  ): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Compte introuvable.');
    if (user.isSuspended) throw new BadRequestException('Ce compte est suspendu.');

    const pending = await this.prisma.phoneChangeRequest.findFirst({
      where: { userId, newPhone, status: OtpStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending || pending.expiresAt < new Date()) {
      throw new BadRequestException('Code expiré ou introuvable — demandez-en un nouveau.');
    }
    if (pending.attempts >= pending.maxAttempts) {
      await this.prisma.phoneChangeRequest.update({ where: { id: pending.id }, data: { status: OtpStatus.FAILED } });
      throw new BadRequestException('Trop de tentatives — demandez un nouveau code.');
    }
    // L'essai est consommé AVANT la comparaison, de façon atomique : des requêtes parallèles ne peuvent pas dépasser le
    // nombre d'essais autorisés.
    const claimed = await this.prisma.phoneChangeRequest.updateMany({
      where: { id: pending.id, status: OtpStatus.PENDING, attempts: { lt: pending.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (claimed.count === 0) throw new BadRequestException('Trop de tentatives — demandez un nouveau code.');
    if (!verifyOtpCode(code, pending.codeHash)) {
      const attempts = pending.attempts + 1;
      if (attempts >= pending.maxAttempts) {
        await this.prisma.phoneChangeRequest.updateMany({
          where: { id: pending.id, status: OtpStatus.PENDING },
          data: { status: OtpStatus.FAILED },
        });
      }
      const remaining = pending.maxAttempts - attempts;
      throw new BadRequestException(
        remaining > 0 ? `Code invalide (${remaining} essai${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}).` : 'Code invalide — demandez un nouveau code.',
      );
    }

    const oldPhone = user.phone;
    try {
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Le numéro a pu être pris par un autre compte depuis la demande : l'unicité en base tranche.
        await tx.user.update({ where: { id: userId }, data: { phone: newPhone, isPhoneVerified: true } });
        await tx.phoneChangeRequest.updateMany({
          where: { userId, status: OtpStatus.PENDING },
          data: { status: OtpStatus.EXPIRED },
        });
        await tx.phoneChangeRequest.update({
          where: { id: pending.id },
          data: { status: OtpStatus.VERIFIED, verifiedAt: new Date() },
        });

        // Les envois pas encore récupérés envoient leur code de récupération au téléphone de l'expéditeur : il suit le compte.
        const profile = await tx.customerProfile.findUnique({ where: { userId }, select: { id: true } });
        if (profile) {
          await tx.shipment.updateMany({
            where: { customerId: profile.id, status: { in: SHIPMENTS_FOLLOWING_SENDER_PHONE }, senderPhone: oldPhone },
            data: { senderPhone: newPhone },
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce numéro vient d’être pris par un autre compte.');
      }
      throw error;
    }

    await this.audit.log({
      actorId: userId,
      entityType: 'User',
      entityId: userId,
      action: 'PHONE_CHANGED',
      diff: { oldPhone, newPhone },
      ipAddress: context.ipAddress,
    });

    // Prévient la personne : si ce changement n'est pas d'elle, elle le saura tout de suite. Best-effort, jamais bloquant.
    if (user.email && !this.isTestStaffEmail(user.email)) {
      this.emailProvider
        .send(
          user.email,
          'Le numéro de votre compte Occa’Z a changé',
          `Le numéro de votre compte Occa'Z vient d'être remplacé par ${maskPhone(newPhone)}. Si ce n'est pas vous, contactez le support immédiatement.`,
        )
        .catch((error: Error) => this.logger.warn(`E-mail d'alerte de changement de numéro non envoyé : ${error.message}`));
    }
    // SMS à l'ancien numéro : motif fermé par défaut (coût). Rouvrable avec SMS_EXTRA_PURPOSES=PHONE_CHANGE_ALERT.
    if (!this.isStaff(user) && !this.isTestPhone(oldPhone) && isSmsPurposeAllowed(SmsPurpose.PHONE_CHANGE_ALERT)) {
      this.smsProvider
        .send(
          oldPhone,
          "Occa'Z : le numéro de votre compte vient d'être remplacé. Si ce n'est pas vous, contactez le support immédiatement.",
          SmsPurpose.PHONE_CHANGE_ALERT,
        )
        .catch((error: Error) => this.logger.warn(`SMS d'alerte vers l'ancien numéro non envoyé : ${error.message}`));
    }

    return this.usersService.getSafeById(userId);
  }

  private async assertCooldownOver(userId: string, days: number): Promise<void> {
    if (days <= 0) return;
    const last = await this.prisma.phoneChangeRequest.findFirst({
      where: { userId, status: OtpStatus.VERIFIED },
      orderBy: { verifiedAt: 'desc' },
      select: { verifiedAt: true },
    });
    if (!last?.verifiedAt) return;
    const nextAllowed = new Date(last.verifiedAt.getTime() + days * DAY_MS);
    if (nextAllowed > new Date()) {
      throw new BadRequestException(
        `Vous avez changé de numéro récemment. Vous pourrez le refaire à partir du ${nextAllowed.toLocaleDateString('fr-FR')}.`,
      );
    }
  }

  /**
   * Chaque demande envoie un SMS payant : au plus `requestLimit` (5 par défaut, réglable dans l'administration) par compte et
   * par fenêtre, et autant vers un même numéro destinataire, quel que soit le compte demandeur — sinon on pourrait inonder
   * le numéro de quelqu'un d'autre.
   */
  private async assertRequestAllowed(userId: string, newPhone: string, settings: OtpSettings): Promise<void> {
    const windowMinutes = settings.requestWindowMinutes;
    const maxRequests = settings.requestLimit;
    const since = new Date(Date.now() - windowMinutes * 60_000);
    const [byUser, byPhone] = await Promise.all([
      this.prisma.phoneChangeRequest.count({ where: { userId, createdAt: { gte: since } } }),
      this.prisma.phoneChangeRequest.count({ where: { newPhone, createdAt: { gte: since } } }),
    ]);
    if (byUser >= maxRequests || byPhone >= maxRequests) {
      throw new HttpException(
        `Trop de demandes de code. Patientez ${windowMinutes} minutes avant de réessayer.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}