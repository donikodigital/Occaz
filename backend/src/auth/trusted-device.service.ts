// backend/src/auth/trusted-device.service.ts
// [30/10/2026] v1 — Téléphones de confiance.
//
// Le mot de passe fait 6 chiffres : s'il est vu ou deviné, il ne doit pas suffire à ouvrir le compte depuis n'importe quel téléphone.
//  - Tant qu'un compte n'a AUCUN téléphone de confiance, la connexion reste telle qu'avant, et l'application propose, à chaque connexion,
//    d'enregistrer le téléphone utilisé.
//  - Dès qu'il en a un, une connexion depuis un autre téléphone exige un code (e-mail en priorité, SMS sinon) : voir AccountAuthService.
// Le téléphone de confiance garde un secret aléatoire remis à l'enregistrement (jamais le mot de passe) ; seul son hash est stocké ici.
// Le compte garde au plus MAX_TRUSTED_DEVICES téléphones : le moins récemment utilisé cède sa place au nouveau.
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { EMAIL_PROVIDER, EmailProvider } from '../integrations/email/email-provider.interface';
import { isTestPhone } from '../common/utils/test-mode.util';

export const MAX_TRUSTED_DEVICES = 5;

export interface TrustedDeviceCredential {
  id: string;
  secret: string;
}

/** Ce que l'application doit savoir après une connexion réussie. */
export interface DeviceTrustInfo {
  /** Le compte a au moins un téléphone de confiance. */
  hasTrustedDevice: boolean;
  /** CE téléphone en est un. */
  thisDeviceTrusted: boolean;
  /** L'application doit demander « Enregistrer ce téléphone comme téléphone de confiance ? ». */
  offer: boolean;
}

export interface TrustedDeviceSummary {
  id: string;
  platform: string | null;
  label: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

const hashSecret = (secret: string): string => createHash('sha256').update(secret).digest('hex');
const sameHash = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

@Injectable()
export class TrustedDeviceService {
  private readonly logger = new Logger(TrustedDeviceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  /**
   * Évalue une connexion dont le mot de passe (ou l'empreinte) vient d'être validé :
   * `verifyRequired` = le compte a des téléphones de confiance et celui-ci n'en est pas un.
   */
  async assess(
    userId: string,
    presented?: TrustedDeviceCredential,
  ): Promise<{ verifyRequired: boolean; trust: DeviceTrustInfo }> {
    const activeCount = await this.prisma.trustedDevice.count({ where: { userId, revokedAt: null } });
    const hasTrustedDevice = activeCount > 0;

    let thisDeviceTrusted = false;
    if (hasTrustedDevice && presented) {
      const row = await this.prisma.trustedDevice.findFirst({ where: { id: presented.id, userId, revokedAt: null } });
      if (row && sameHash(hashSecret(presented.secret), row.secretHash)) {
        thisDeviceTrusted = true;
        await this.prisma.trustedDevice
          .updateMany({ where: { id: row.id, revokedAt: null }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined);
      }
    }

    return {
      verifyRequired: hasTrustedDevice && !thisDeviceTrusted,
      trust: { hasTrustedDevice, thisDeviceTrusted, offer: !thisDeviceTrusted },
    };
  }

  /** Enregistre le téléphone de la session en cours. Renvoie l'identifiant et le secret à garder dans le coffre du téléphone. */
  async register(
    userId: string,
    dto: { platform?: 'ios' | 'android'; label?: string },
    context: { ipAddress?: string } = {},
  ): Promise<TrustedDeviceCredential> {
    const user = await this.usersService.findById(userId);
    if (!user || (user.accountType !== AccountType.CUSTOMER && user.accountType !== AccountType.DRIVER)) {
      throw new BadRequestException('Ce type de compte ne peut pas enregistrer de téléphone de confiance.');
    }
    if (user.isSuspended || !user.isActive) throw new BadRequestException('Ce compte est suspendu.');

    const secret = randomBytes(32).toString('base64url');
    const created = await this.prisma.trustedDevice.create({
      data: { userId, secretHash: hashSecret(secret), platform: dto.platform ?? null, label: dto.label?.trim() || null, lastUsedAt: new Date() },
    });

    // Au plus MAX_TRUSTED_DEVICES : on retire les moins récemment utilisés.
    const active = await this.prisma.trustedDevice.findMany({
      where: { userId, revokedAt: null },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    const surplus = active.filter((row: { id: string }) => row.id !== created.id).slice(MAX_TRUSTED_DEVICES - 1).map((row: { id: string }) => row.id);
    if (surplus.length > 0) {
      await this.prisma.trustedDevice.updateMany({ where: { id: { in: surplus } }, data: { revokedAt: new Date() } });
    }

    await this.audit.log({
      actorId: userId,
      entityType: 'User',
      entityId: userId,
      action: 'TRUSTED_DEVICE_ADDED',
      diff: { platform: dto.platform ?? null, label: dto.label ?? null },
      ipAddress: context.ipAddress,
    });
    await this.notifyByEmail(user, "Un nouveau téléphone de confiance a été ajouté à votre compte Occa’Z. Si ce n'est pas vous, ouvrez l'application, retirez ce téléphone dans Profil → Téléphones de confiance et changez votre mot de passe.");
    return { id: created.id, secret };
  }

  async list(userId: string): Promise<TrustedDeviceSummary[]> {
    return this.prisma.trustedDevice.findMany({
      where: { userId, revokedAt: null },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, platform: true, label: true, createdAt: true, lastUsedAt: true },
    });
  }

  async revoke(userId: string, deviceId: string, context: { ipAddress?: string } = {}): Promise<void> {
    const revoked = await this.prisma.trustedDevice.updateMany({
      where: { id: deviceId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw new NotFoundException('Téléphone introuvable.');
    await this.audit.log({
      actorId: userId,
      entityType: 'User',
      entityId: userId,
      action: 'TRUSTED_DEVICE_REMOVED',
      diff: { deviceId },
      ipAddress: context.ipAddress,
    });
  }

  /** Meilleur effort : l'alerte ne bloque jamais l'enregistrement. Les numéros de test n'envoient rien. */
  private async notifyByEmail(user: { phone: string; email: string | null; isEmailVerified: boolean }, text: string): Promise<void> {
    if (!user.email || !user.isEmailVerified || isTestPhone(user.phone)) return;
    try {
      await this.emailProvider.send(user.email, 'Nouveau téléphone de confiance — Occa’Z', text);
    } catch (error) {
      this.logger.warn(`Alerte « nouveau téléphone de confiance » non envoyée : ${(error as Error).message}`);
    }
  }
}
