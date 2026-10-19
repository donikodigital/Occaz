// backend/src/wallets/pin-confirmation.service.ts
// [19/10/2026] v1 — Confirmation d'une opération d'argent par le CODE PIN DE CONNEXION du conducteur (6 chiffres), à la place d'un SMS.
// Un SMS coûte cher et peut être intercepté (échange de SIM) ; le PIN, lui, est un secret que seul le conducteur connaît.
//
// Les essais ratés comptent dans le MÊME compteur que la connexion (User.failedLoginAttempts / lockedUntil) : 5 erreurs de suite verrouillent
// le compte 15 minutes, que l'on devine le PIN depuis l'écran de connexion ou depuis l'écran de retrait — pas de second guichet pour
// contourner la limite. Un PIN juste remet le compteur à zéro.
import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { isPinFormat, pinDigest } from '../common/utils/pin.util';
import { TEST_CODE, isTestPhone } from '../common/utils/test-mode.util';

/** Mêmes valeurs que la connexion (account-auth.service.ts) : un seul compteur, une seule règle. */
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class PinConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Lève une erreur si le PIN n'est pas le bon. Ne renvoie rien en cas de succès. */
  async assertPin(userId: string, pin: string, action: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, passwordHash: true, failedLoginAttempts: true, lockedUntil: true },
    });
    if (!user) throw new ForbiddenException('Compte introuvable.');
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) throw this.lockedError(user.lockedUntil);
    const testBypass = Boolean(user.phone) && isTestPhone(user.phone) && pin === TEST_CODE;
    if (!user.passwordHash && !testBypass) {
      throw new ForbiddenException("Ton code PIN n'est pas encore défini : définis-le d'abord pour pouvoir confirmer un retrait.");
    }
    const valid = testBypass || (isPinFormat(pin) && (await bcrypt.compare(pinDigest(pin), user.passwordHash as string)));
    if (!valid) {
      const lockedUntil = await this.registerFailure(user.id, action);
      if (lockedUntil) throw this.lockedError(lockedUntil);
      throw new ForbiddenException('Code PIN incorrect.');
    }

    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }
  }

  private async registerFailure(userId: string, action: string): Promise<Date | null> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
    await this.audit.log({ actorId: userId, entityType: 'User', entityId: userId, action: 'PIN_CONFIRMATION_FAILED', diff: { for: action } });
    if (updated.failedLoginAttempts < MAX_FAILURES) return null;

    const lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
    await this.prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil } });
    await this.audit.log({ actorId: userId, entityType: 'User', entityId: userId, action: 'LOGIN_LOCKED', diff: { for: action } });
    return lockedUntil;
  }

  private lockedError(lockedUntil: Date): HttpException {
    const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
    return new HttpException(
      `Trop d'essais. Réessaie dans ${minutes} minute${minutes > 1 ? 's' : ''}, ou utilise « Mot de passe oublié » à la connexion.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
