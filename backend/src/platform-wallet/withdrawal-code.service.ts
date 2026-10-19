// backend/src/platform-wallet/withdrawal-code.service.ts
// [19/10/2026] v1 — Code de confirmation des retraits de la PLATEFORME, envoyé par E-MAIL au SuperAdmin (jamais par SMS) :
// remplace le mot de passe qui était saisi en clair dans la fenêtre de retrait.
//
//  - 6 chiffres, valable 10 minutes, 3 essais, un seul code actif à la fois (une nouvelle demande annule la précédente) ;
//  - LIÉ au retrait demandé : bénéficiaire + devise + montant. Changer l'un des trois invalide le code, donc un code intercepté ne
//    sert pas à retirer autre chose que ce que le SuperAdmin a vu dans l'e-mail ;
//  - à usage unique (consommé atomiquement) et seul le hash est conservé (HMAC avec OTP_HASH_PEPPER, comme les autres codes) ;
//  - au plus 5 envois par heure et par compte.
import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { OtpPurpose, OtpStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EMAIL_PROVIDER, EmailProvider } from '../integrations/email/email-provider.interface';
import { generateOtpCode, hashOtpCode, verifyOtpCode } from '../common/utils/otp.util';
import { maskEmail } from '../common/utils/mask.util';
import { TEST_CODE } from '../common/utils/test-mode.util';
import { formatMoneyWithCurrency } from '../common/utils/money.util';

export const WITHDRAWAL_CODE_TTL_MINUTES = 10;
export const WITHDRAWAL_CODE_MAX_ATTEMPTS = 3;
export const WITHDRAWAL_CODE_MAX_PER_HOUR = 5;

export interface WithdrawalCodeTarget {
  beneficiaryId: string;
  currencyId: string;
  amount: bigint;
}

/** Ce que le code protège : sert de « cible » stockée avec le hash. */
const targetOf = (t: WithdrawalCodeTarget) => `withdrawal:${t.beneficiaryId}:${t.currencyId}:${t.amount.toString()}`;

@Injectable()
export class WithdrawalCodeService {
  private readonly logger = new Logger(WithdrawalCodeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {}

  /** Envoie le code par e-mail. `summary` décrit le retrait en clair dans le message (bénéficiaire, montant). */
  async send(userId: string, target: WithdrawalCodeTarget, summary: { beneficiaryLabel: string; isoCode: string }): Promise<{ expiresInSeconds: number; sentTo: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
    if (!user?.email) {
      throw new BadRequestException("Ton compte n'a pas d'adresse e-mail : impossible de t'envoyer le code de confirmation d'un retrait.");
    }

    const sentLastHour = await this.prisma.otpCode.count({
      where: { userId, purpose: OtpPurpose.WITHDRAWAL, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
    });
    if (sentLastHour >= WITHDRAWAL_CODE_MAX_PER_HOUR) {
      throw new HttpException('Trop de codes demandés. Réessaie dans une heure.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const testMode = process.env.AUTH_TEST_MODE_ENABLED === 'true' && (process.env.AUTH_TEST_STAFF_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).includes(user.email.toLowerCase());
    const code = testMode ? TEST_CODE : generateOtpCode();

    // Un seul code actif : les précédents (pour ce compte) sont annulés.
    await this.prisma.otpCode.updateMany({
      where: { userId, purpose: OtpPurpose.WITHDRAWAL, status: OtpStatus.PENDING },
      data: { status: OtpStatus.EXPIRED },
    });
    const row = await this.prisma.otpCode.create({
      data: {
        userId,
        purpose: OtpPurpose.WITHDRAWAL,
        status: OtpStatus.PENDING,
        code: hashOtpCode(code),
        target: targetOf(target),
        maxAttempts: WITHDRAWAL_CODE_MAX_ATTEMPTS,
        expiresAt: new Date(Date.now() + WITHDRAWAL_CODE_TTL_MINUTES * 60_000),
      },
    });

    if (!testMode) {
      const amountText = formatMoneyWithCurrency(target.amount, summary.isoCode);
      try {
        await this.email.send(
          user.email,
          'Code de confirmation de retrait Occa’Z',
          `Votre code de confirmation est ${code}. Il confirme UN retrait de ${amountText} vers ${summary.beneficiaryLabel}, et expire dans ${WITHDRAWAL_CODE_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ne communiquez ce code à personne et prévenez un administrateur.`,
        );
      } catch (error) {
        await this.prisma.otpCode.delete({ where: { id: row.id } }).catch(() => undefined);
        this.logger.error(`E-mail de retrait non envoyé à ${maskEmail(user.email)} : ${(error as Error).message}`);
        throw new ServiceUnavailableException("L'e-mail n'a pas pu être envoyé. Réessaie dans un instant.");
      }
    } else {
      this.logger.warn(`[MODE TEST] Code de retrait fixe pour ${maskEmail(user.email)} : ${TEST_CODE} — aucun e-mail envoyé.`);
    }

    await this.audit.log({ actorId: userId, entityType: 'PlatformWithdrawal', entityId: row.id, action: 'CODE_SENT', diff: { beneficiaryId: target.beneficiaryId, currencyId: target.currencyId, amount: target.amount.toString() } });
    return { expiresInSeconds: WITHDRAWAL_CODE_TTL_MINUTES * 60, sentTo: maskEmail(user.email) };
  }

  /** Vérifie ET consomme le code. Lève une erreur claire sinon ; les messages ne disent pas pourquoi exactement (aucun indice). */
  async consume(userId: string, target: WithdrawalCodeTarget, code: string): Promise<void> {
    const row = await this.prisma.otpCode.findFirst({
      where: { userId, purpose: OtpPurpose.WITHDRAWAL, status: OtpStatus.PENDING, expiresAt: { gt: new Date() }, target: targetOf(target) },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) {
      throw new UnauthorizedException('Code expiré ou ne correspondant pas à ce retrait. Demande un nouveau code.');
    }

    // Essai compté AVANT la comparaison, de façon atomique : deux requêtes simultanées ne peuvent pas dépasser le plafond d'essais.
    const counted = await this.prisma.otpCode.updateMany({
      where: { id: row.id, status: OtpStatus.PENDING, attempts: { lt: row.maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (counted.count === 0) {
      await this.prisma.otpCode.updateMany({ where: { id: row.id, status: OtpStatus.PENDING }, data: { status: OtpStatus.EXPIRED } });
      throw new UnauthorizedException('Trop d’essais. Demande un nouveau code.');
    }

    if (!/^\d{6}$/.test(code) || !verifyOtpCode(code, row.code)) {
      const left = row.maxAttempts - (row.attempts + 1);
      if (left <= 0) {
        await this.prisma.otpCode.updateMany({ where: { id: row.id, status: OtpStatus.PENDING }, data: { status: OtpStatus.EXPIRED } });
        throw new UnauthorizedException('Code incorrect. Trop d’essais : demande un nouveau code.');
      }
      throw new UnauthorizedException(`Code incorrect. Il te reste ${left} essai${left > 1 ? 's' : ''}.`);
    }

    // Usage unique : seul le premier appel qui passe de PENDING à VERIFIED réussit.
    const used = await this.prisma.otpCode.updateMany({
      where: { id: row.id, status: OtpStatus.PENDING },
      data: { status: OtpStatus.VERIFIED, verifiedAt: new Date() },
    });
    if (used.count === 0) throw new UnauthorizedException('Ce code a déjà été utilisé. Demande un nouveau code.');
  }
}
