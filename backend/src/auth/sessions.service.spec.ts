// backend/src/auth/sessions.service.spec.ts
// Rotation du refresh token : période de grâce après une réponse perdue, vol de jeton toujours détecté.
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { REFRESH_REUSE_GRACE_MS, SessionsService } from './sessions.service';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

function build(session: Record<string, unknown> | null) {
  const prisma = {
    session: {
      findUnique: jest.fn().mockResolvedValue(session),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    biometricCredential: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  return { service: new SessionsService(prisma as never), prisma };
}

const live = (extra: Record<string, unknown> = {}) => ({
  id: 's1', isRevoked: false, expiresAt: new Date(Date.now() + 86_400_000), refreshTokenHash: hash('B'),
  previousRefreshTokenHash: hash('A'), refreshRotatedAt: new Date(Date.now() - 10_000), ...extra,
});

describe('SessionsService.validateRefreshToken', () => {
  it('jeton courant : accepté', async () => {
    const { service, prisma } = build(live());
    await expect(service.validateRefreshToken('s1', 'B')).resolves.toBeDefined();
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  it('jeton précédent présenté dans la période de grâce (réponse perdue en route) : accepté, la session reste ouverte', async () => {
    const { service, prisma } = build(live());
    await expect(service.validateRefreshToken('s1', 'A')).resolves.toBeDefined();
    expect(prisma.session.update).not.toHaveBeenCalled();
  });

  it('jeton précédent après la période de grâce : vol présumé, session révoquée', async () => {
    const { service, prisma } = build(live({ refreshRotatedAt: new Date(Date.now() - REFRESH_REUSE_GRACE_MS - 5_000) }));
    await expect(service.validateRefreshToken('s1', 'A')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { isRevoked: true } });
  });

  it('jeton inconnu : session révoquée', async () => {
    const { service, prisma } = build(live());
    await expect(service.validateRefreshToken('s1', 'Z')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.session.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { isRevoked: true } });
  });

  it('session révoquée ou expirée : refusée', async () => {
    await expect(build(live({ isRevoked: true })).service.validateRefreshToken('s1', 'B')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(build(live({ expiresAt: new Date(Date.now() - 1) })).service.validateRefreshToken('s1', 'B')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('SessionsService.rotateRefreshToken', () => {
  const expiresAt = new Date(Date.now() + 86_400_000);

  it('rotation normale : conditionnée au jeton réellement courant, l\'ancien est gardé comme « précédent »', async () => {
    const { service, prisma } = build(live());
    await service.rotateRefreshToken('s1', 'B', 'C', expiresAt);
    expect(prisma.session.updateMany).toHaveBeenCalledTimes(1);
    const call = prisma.session.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 's1', isRevoked: false, refreshTokenHash: hash('B') });
    expect(call.data).toMatchObject({ refreshTokenHash: hash('C'), previousRefreshTokenHash: hash('B'), expiresAt });
    expect(call.data.refreshRotatedAt).toBeInstanceOf(Date);
  });

  it('deux renouvellements simultanés avec le même jeton : le second passe par la période de grâce sans prolonger la fenêtre', async () => {
    const { service, prisma } = build(live());
    prisma.session.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    await service.rotateRefreshToken('s1', 'A', 'C', expiresAt);
    const grace = prisma.session.updateMany.mock.calls[1][0];
    expect(grace.where).toMatchObject({ id: 's1', isRevoked: false, previousRefreshTokenHash: hash('A') });
    expect(grace.where.refreshRotatedAt.gte).toBeInstanceOf(Date);
    expect(grace.data).toEqual({ refreshTokenHash: hash('C'), expiresAt });
    expect(grace.data).not.toHaveProperty('refreshRotatedAt');
  });

  it('jeton ni courant ni dans la grâce : refusé', async () => {
    const { service, prisma } = build(live());
    prisma.session.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.rotateRefreshToken('s1', 'Z', 'C', expiresAt)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('SessionsService — l\'empreinte ne survit pas à un événement de sécurité', () => {
  it('déconnexion de toutes les sessions : les accès par empreinte sont révoqués aussi', async () => {
    const { service, prisma } = build(null);
    await service.revokeAllForUser('u1');
    expect(prisma.biometricCredential.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('changement de mot de passe (autres appareils déconnectés) : accès par empreinte révoqués', async () => {
    const { service, prisma } = build(null);
    await service.revokeOthersForUser('u1', 's1');
    expect(prisma.biometricCredential.updateMany).toHaveBeenCalledTimes(1);
  });

  it('déconnexion d\'une seule session : l\'empreinte reste active (reconnexion rapide)', async () => {
    const { service, prisma } = build(null);
    await service.revoke('s1');
    expect(prisma.biometricCredential.updateMany).not.toHaveBeenCalled();
  });
});
