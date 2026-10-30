// backend/src/auth/biometric-auth.service.ts
// [30/10/2026] v2 — Téléphones de confiance : sur un téléphone inconnu d'un compte qui en a, l'empreinte ne suffit pas, un code est demandé.
// [30/10/2026] v1 — Connexion rapide par empreinte digitale (ou visage) pour les clients et conducteurs.
//
// Principe : l'empreinte ne quitte JAMAIS le téléphone — c'est le système (Android / iOS) qui la vérifie et qui, en cas de succès,
// libère un secret aléatoire gardé dans le coffre sécurisé de l'appareil. Ce secret est ce que l'API reçoit ; elle n'en conserve que le
// hash. Le mot de passe n'est jamais stocké sur le téléphone.
//
//  - Activation : le mot de passe est demandé (même verrouillage que la connexion), pour qu'un téléphone prêté ou oublié déverrouillé ne
//    puisse pas se créer un accès durable.
//  - Connexion : le secret change à chaque connexion. L'ancien reste accepté une minute (réponse perdue en route) ; au-delà, sa
//    réutilisation signale une copie du secret et l'accès est révoqué.
//  - Révocation : désactivation depuis le profil, changement / oubli du mot de passe et « se déconnecter partout » (SessionsService)
//    coupent les accès. Un compte suspendu ou désactivé ne peut plus se connecter de cette façon.
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
import { DevicesService } from '../devices/devices.service';
import { AccountAuthService, DeviceVerificationRequired } from './account-auth.service';
import { DeviceTrustInfo, TrustedDeviceCredential, TrustedDeviceService } from './trusted-device.service';
import { AuthResult, AuthService } from './auth.service';
import { DeviceInfoDto } from './dto/device-info.dto';

/** Pendant ce délai après un renouvellement, le secret précédent est encore accepté (la réponse a pu se perdre). */
export const BIOMETRIC_ROTATION_GRACE_MS = 60_000;
/** Téléphones pouvant utiliser l'empreinte en même temps pour un compte ; au-delà, le plus ancien est révoqué. */
export const MAX_BIOMETRIC_DEVICES = 5;

type RequestContext = { ipAddress?: string; userAgent?: string };

export interface BiometricCredentialSummary {
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
const newSecret = (): string => randomBytes(32).toString('base64url');

@Injectable()
export class BiometricAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly devicesService: DevicesService,
    private readonly accountAuth: AccountAuthService,
    private readonly authService: AuthService,
    private readonly audit: AuditService,
    private readonly trustedDevices: TrustedDeviceService,
  ) {}

  /** Active l'empreinte sur ce téléphone. Renvoie l'identifiant et le secret à ranger dans le coffre sécurisé de l'appareil. */
  async enable(
    userId: string,
    dto: { password: string; platform?: 'ios' | 'android'; label?: string },
    context: RequestContext,
  ): Promise<{ credentialId: string; token: string }> {
    const user = await this.usersService.findById(userId);
    if (!user || (user.accountType !== AccountType.CUSTOMER && user.accountType !== AccountType.DRIVER)) {
      throw new BadRequestException("Ce type de compte ne peut pas utiliser la connexion par empreinte.");
    }
    if (user.isSuspended || !user.isActive) throw new BadRequestException('Ce compte est suspendu.');

    // Mot de passe vérifié avec le même verrouillage que la connexion (erreurs comptées, 429 après 5 erreurs).
    await this.accountAuth.assertCurrentPassword(userId, dto.password);

    const token = newSecret();
    const credential = await this.prisma.biometricCredential.create({
      data: {
        userId,
        tokenHash: hashSecret(token),
        platform: dto.platform ?? null,
        label: dto.label?.trim() || null,
      },
    });

    // Au plus MAX_BIOMETRIC_DEVICES accès actifs : les plus anciens sont révoqués.
    const active = await this.prisma.biometricCredential.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const surplus = active.slice(MAX_BIOMETRIC_DEVICES).map((row: { id: string }) => row.id);
    if (surplus.length > 0) {
      await this.prisma.biometricCredential.updateMany({ where: { id: { in: surplus } }, data: { revokedAt: new Date() } });
    }

    await this.audit.log({
      actorId: userId,
      entityType: 'User',
      entityId: userId,
      action: 'BIOMETRIC_ENABLED',
      ipAddress: context.ipAddress,
    });
    return { credentialId: credential.id, token };
  }

  /** Connexion avec le secret libéré par l'empreinte. Le secret est renouvelé à chaque connexion réussie. */
  async login(
    dto: { credentialId: string; token: string; device?: DeviceInfoDto; trustedDevice?: TrustedDeviceCredential },
    context: RequestContext,
  ): Promise<(AuthResult & { biometricToken: string; trust: DeviceTrustInfo }) | DeviceVerificationRequired> {
    const refused = () => new UnauthorizedException('Connexion par empreinte expirée : connectez-vous avec votre mot de passe.');

    const credential = await this.prisma.biometricCredential.findUnique({ where: { id: dto.credentialId } });
    if (!credential || credential.revokedAt) throw refused();

    const presented = hashSecret(dto.token);
    const isCurrent = sameHash(presented, credential.tokenHash);
    const isPrevious = Boolean(credential.previousTokenHash) && sameHash(presented, credential.previousTokenHash!);
    const inGrace = isPrevious && Boolean(credential.rotatedAt) && Date.now() - credential.rotatedAt!.getTime() <= BIOMETRIC_ROTATION_GRACE_MS;

    if (!isCurrent && !inGrace) {
      if (isPrevious) {
        // Un ancien secret rejoué hors période de grâce : il a été copié. L'accès est coupé.
        await this.prisma.biometricCredential.update({ where: { id: credential.id }, data: { revokedAt: new Date() } });
        await this.audit.log({
          actorId: credential.userId,
          entityType: 'User',
          entityId: credential.userId,
          action: 'BIOMETRIC_REPLAY_REVOKED',
          ipAddress: context.ipAddress,
        });
      }
      throw refused();
    }

    const user = await this.usersService.findById(credential.userId);
    if (!user || (user.accountType !== AccountType.CUSTOMER && user.accountType !== AccountType.DRIVER)) throw refused();
    if (!user.isActive || user.isSuspended) throw new UnauthorizedException('Ce compte est suspendu.');

    // Téléphone inconnu d'un compte qui a des téléphones de confiance : l'empreinte ne suffit pas. Le secret n'est pas renouvelé ici,
    // l'application garde donc le sien et pourra réessayer après le code.
    const assessment = await this.trustedDevices.assess(user.id, dto.trustedDevice);
    if (assessment.verifyRequired) return this.accountAuth.challengeUnknownDevice(user.id, context);

    // Renouvellement conditionnel : deux requêtes simultanées avec le même secret ne passent pas toutes les deux sur le chemin normal.
    const nextToken = newSecret();
    const rotated = await this.prisma.biometricCredential.updateMany({
      where: isCurrent
        ? { id: credential.id, revokedAt: null, tokenHash: credential.tokenHash }
        : { id: credential.id, revokedAt: null, previousTokenHash: credential.previousTokenHash },
      data: isCurrent
        ? { tokenHash: hashSecret(nextToken), previousTokenHash: credential.tokenHash, rotatedAt: new Date(), lastUsedAt: new Date() }
        : { tokenHash: hashSecret(nextToken), lastUsedAt: new Date() },
    });
    if (rotated.count === 0) throw refused();

    const device = await this.devicesService.findOrCreateForLogin(user.id, dto.device);
    const result = await this.authService.issueTokens(user, {
      deviceId: device?.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    await this.usersService.updateLastLogin(user.id);
    await this.audit.log({
      actorId: user.id,
      entityType: 'User',
      entityId: user.id,
      action: 'LOGIN_BIOMETRIC',
      ipAddress: context.ipAddress,
    });
    return { ...result, biometricToken: nextToken, trust: assessment.trust };
  }

  /** Désactive l'empreinte sur ce téléphone (idempotent : un accès déjà révoqué ou inconnu ne produit pas d'erreur). */
  async disable(userId: string, credentialId: string, context: RequestContext): Promise<void> {
    const revoked = await this.prisma.biometricCredential.updateMany({
      where: { id: credentialId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count > 0) {
      await this.audit.log({
        actorId: userId,
        entityType: 'User',
        entityId: userId,
        action: 'BIOMETRIC_DISABLED',
        ipAddress: context.ipAddress,
      });
    }
  }

  /** Téléphones sur lesquels l'empreinte est active (l'app compare avec son propre identifiant pour rester à jour). */
  async list(userId: string): Promise<BiometricCredentialSummary[]> {
    return this.prisma.biometricCredential.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, platform: true, label: true, createdAt: true, lastUsedAt: true },
    });
  }
}
