// backend/src/auth/sessions.service.ts
// [30/10/2026] v+ — la déconnexion globale et le changement de mot de passe révoquent aussi les accès par empreinte (BiometricAuthService).
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Une Session correspond à un couple (utilisateur, appareil) authentifié —
 * elle porte le hash du refresh token courant, ce qui permet la
 * révocation individuelle par appareil ou globale (section
 * Authentification / Sécurité SuperAdmin, sections 3.1 et 36).
 */
/**
 * Période de grâce après une rotation : le téléphone qui a envoyé le jeton A, reçu B... et perdu la réponse (tunnel, coupure réseau)
 * présente encore A. Dans cette fenêtre, A est accepté UNE nouvelle fois (au lieu de couper la session comme un vol de jeton).
 * Passé ce délai, la ré-utilisation d'un ancien jeton reste traitée comme un vol : la session est révoquée.
 */
export const REFRESH_REUSE_GRACE_MS = 60_000;

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(params: {
    id?: string;
    userId: string;
    deviceId?: string;
    refreshToken: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }) {
    return this.prisma.session.create({
      data: {
        id: params.id,
        userId: params.userId,
        deviceId: params.deviceId,
        refreshTokenHash: this.hashToken(params.refreshToken),
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        expiresAt: params.expiresAt,
      },
    });
  }

  async validateAndGet(sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session invalide ou expirée.');
    }
    return session;
  }

  async validateRefreshToken(sessionId: string, presentedToken: string) {
    const session = await this.validateAndGet(sessionId);
    const presentedHash = this.hashToken(presentedToken);
    if (session.refreshTokenHash === presentedHash) return session;
    if (this.isWithinGrace(session, presentedHash)) return session;
    // Ré-utilisation d'un refresh token déjà tourné (hors période de grâce) : signe possible de vol de jeton — on révoque la
    // session par précaution.
    await this.revoke(sessionId);
    throw new UnauthorizedException('Refresh token invalide.');
  }

  private isWithinGrace(
    session: { previousRefreshTokenHash?: string | null; refreshRotatedAt?: Date | null },
    presentedHash: string,
  ): boolean {
    return (
      Boolean(session.previousRefreshTokenHash) &&
      session.previousRefreshTokenHash === presentedHash &&
      Boolean(session.refreshRotatedAt) &&
      Date.now() - session.refreshRotatedAt!.getTime() <= REFRESH_REUSE_GRACE_MS
    );
  }

  /**
   * Remplace le refresh token de la session, de façon CONDITIONNELLE : seul le jeton réellement courant (ou, dans la période de
   * grâce, le précédent) peut le faire. Deux renouvellements simultanés avec le même jeton ne s'écrasent donc plus en silence.
   */
  async rotateRefreshToken(sessionId: string, presentedToken: string, newRefreshToken: string, newExpiresAt: Date) {
    const presentedHash = this.hashToken(presentedToken);
    const newHash = this.hashToken(newRefreshToken);

    const normal = await this.prisma.session.updateMany({
      where: { id: sessionId, isRevoked: false, refreshTokenHash: presentedHash },
      data: { refreshTokenHash: newHash, previousRefreshTokenHash: presentedHash, refreshRotatedAt: new Date(), expiresAt: newExpiresAt },
    });
    if (normal.count > 0) return;

    // Le jeton présenté vient d'être tourné par une autre requête (ou la réponse précédente s'est perdue) : accepté dans la période
    // de grâce. L'ancien jeton reste « précédent » : la fenêtre ne se prolonge pas.
    const grace = await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        isRevoked: false,
        previousRefreshTokenHash: presentedHash,
        refreshRotatedAt: { gte: new Date(Date.now() - REFRESH_REUSE_GRACE_MS) },
      },
      data: { refreshTokenHash: newHash, expiresAt: newExpiresAt },
    });
    if (grace.count === 0) throw new UnauthorizedException('Refresh token invalide.');
  }

  async revoke(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  /** Déconnexion de toutes les sessions — exigence SuperAdmin, section 3.1. L'accès par empreinte est coupé avec elles. */
  async revokeAllForUser(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    await this.revokeBiometricAccess(userId);
  }

  /** Les accès par empreinte ne survivent pas à un événement de sécurité (mot de passe changé, déconnexion partout) : mot de passe à nouveau. */
  private async revokeBiometricAccess(userId: string) {
    await this.prisma.biometricCredential.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Coupe toutes les sessions sauf celle en cours (changement de mot de passe : l'appareil utilisé reste connecté). */
  async revokeOthersForUser(userId: string, keepSessionId: string) {
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false, id: { not: keepSessionId } },
      data: { isRevoked: true },
    });
    await this.revokeBiometricAccess(userId);
  }
}
