// backend/src/auth/sessions.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Une Session correspond à un couple (utilisateur, appareil) authentifié —
 * elle porte le hash du refresh token courant, ce qui permet la
 * révocation individuelle par appareil ou globale (section
 * Authentification / Sécurité SuperAdmin, sections 3.1 et 36).
 */
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
    if (session.refreshTokenHash !== this.hashToken(presentedToken)) {
      // Ré-utilisation d'un refresh token déjà tourné : signe possible de
      // vol de jeton — on révoque la session par précaution.
      await this.revoke(sessionId);
      throw new UnauthorizedException('Refresh token invalide.');
    }
    return session;
  }

  async rotateRefreshToken(sessionId: string, newRefreshToken: string, newExpiresAt: Date) {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: this.hashToken(newRefreshToken),
        expiresAt: newExpiresAt,
      },
    });
  }

  async revoke(sessionId: string) {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  /** Déconnexion de toutes les sessions — exigence SuperAdmin, section 3.1. */
  async revokeAllForUser(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }
}
