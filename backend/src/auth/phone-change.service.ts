// backend/src/auth/phone-change.service.ts
//
// Changement de numéro de téléphone (Client et Conducteur). Le numéro est l'identifiant de connexion : on ne l'adopte qu'une
// fois prouvé que la personne possède le NOUVEAU numéro, en lui envoyant un code par SMS.
//
// Garde-fous :
//  - le code est lié au numéro auquel il a été envoyé (table PhoneChangeRequest) : un code reçu sur le numéro A ne valide jamais B ;
//  - le nouveau numéro ne doit appartenir à aucun autre compte (un numéro = un compte) ;
//  - limites d'envoi par compte ET par numéro destinataire : un script ne peut pas inonder de SMS le numéro de quelqu'un d'autre ;
//  - 3 essais par code ; un nouveau code annule le précédent ;
//  - délai entre deux changements (PHONE_CHANGE_COOLDOWN_DAYS, 30 par défaut, 0 pour désactiver) ;
//  - l'ANCIEN numéro est prévenu par SMS : si le changement n'est pas de la personne (session volée), elle le sait aussitôt ;
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
import { ConfigService } from '@nestjs/config';
import { AccountType, OtpStatus, Prisma, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService, SafeUser } from '../users/users.service';
import { SMS_PROVIDER, SmsProvider } from '../integrations/sms/sms-provider.interface';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '../common/utils/otp.util';
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
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  /** Même mode test que la connexion : seuls les numéros listés dans AUTH_TEST_PHONE_NUMBERS, et jamais en production réelle. */
  private isTestPhone(phone: string): boolean {
    if (process.env.AUTH_TEST_MODE_ENABLED !== 'true') return false;
    return (process.env.AUTH_TEST_PHONE_NUMBERS ?? '')
      .split(',')
      .map((candidate) => candidate.trim())
      .includes(phone);
  }

  private get cooldownDays(): number {
    const value = Number(process.env.PHONE_CHANGE_COOLDOWN_DAYS ?? 30);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  /** Étape 1 : vérifie que le changement est possible, puis envoie un code par SMS au nouveau numéro. */
  async request(userId: string, newPhone: string): Promise<{ expiresInSeconds: number }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new BadRequestException('Compte introuvable.');
    if (user.accountType !== AccountType.CUSTOMER && user.accountType !== AccountType.DRIVER) {
      throw new ForbiddenException('Le changement de numéro est réservé aux comptes Client et Conducteur.');
    }
    if (user.isSuspended) throw new BadRequestException('Ce compte est suspendu.');
    if (newPhone === user.phone) throw new BadRequestException("C'est déjà le numéro de votre compte.");

    const owner = await this.usersService.findByPhone(newPhone);
    if (owner) throw new ConflictException('Ce numéro est déjà utilisé par un autre compte.');

    await this.assertCooldownOver(userId);

    const isTest = this.isTestPhone(newPhone);
    if (!isTest) await this.assertRequestAllowed(userId, newPhone);

    const expirySeconds = this.configService.get<number>('otp.expirySeconds')!;
    const maxAttempts = this.configService.get<number>('otp.maxAttempts')!;
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

    if (isTest) {
      this.logger.warn(`[MODE TEST] Changement de numéro vers ${newPhone} : code fixe ${TEST_CODE}, aucun SMS envoyé.`);
    } else {
      try {
        await this.smsProvider.send(
          newPhone,
          `Occa'Z : votre code pour changer de numéro est ${code}. Il expire dans ${Math.round(expirySeconds / 60)} minutes. Ne le communiquez à personne.`,
        );
      } catch (error) {
        await this.prisma.phoneChangeRequest.update({ where: { id: created.id }, data: { status: OtpStatus.FAILED } });
        this.logger.warn(`SMS de changement de numéro non envoyé : ${(error as Error).message}`);
        throw new ServiceUnavailableException("Le SMS n'a pas pu être envoyé. Réessayez dans un instant.");
      }
    }

    return { expiresInSeconds: expirySeconds };
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
    if (!verifyOtpCode(code, pending.codeHash)) {
      const attempts = pending.attempts + 1;
      await this.prisma.phoneChangeRequest.update({
        where: { id: pending.id },
        data: { attempts, ...(attempts >= pending.maxAttempts ? { status: OtpStatus.FAILED } : {}) },
      });
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

    // Prévient l'ancien numéro : si ce changement n'est pas de la personne, elle le saura tout de suite. Best-effort.
    if (!this.isTestPhone(oldPhone)) {
      this.smsProvider
        .send(
          oldPhone,
          "Occa'Z : le numéro de votre compte vient d'être remplacé. Si ce n'est pas vous, contactez le support immédiatement.",
        )
        .catch((error: Error) => this.logger.warn(`SMS d'alerte vers l'ancien numéro non envoyé : ${error.message}`));
    }

    return this.usersService.getSafeById(userId);
  }

  private async assertCooldownOver(userId: string): Promise<void> {
    const days = this.cooldownDays;
    if (days === 0) return;
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
   * Chaque demande envoie un SMS payant : au plus OTP_REQUEST_LIMIT (5) par compte et par fenêtre, et autant vers un même
   * numéro destinataire, quel que soit le compte demandeur — sinon on pourrait inonder le numéro de quelqu'un d'autre.
   */
  private async assertRequestAllowed(userId: string, newPhone: string): Promise<void> {
    const windowMinutes = Number(process.env.OTP_REQUEST_WINDOW_MINUTES ?? 15);
    const maxRequests = Number(process.env.OTP_REQUEST_LIMIT ?? 5);
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