// backend/src/auth/biometric-auth.service.spec.ts
// Connexion par empreinte : activation avec mot de passe, secret renouvelé à chaque usage, rejeu détecté, comptes suspendus refusés.
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { createHash } from 'crypto';
import { BIOMETRIC_ROTATION_GRACE_MS, BiometricAuthService, MAX_BIOMETRIC_DEVICES } from './biometric-auth.service';

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');

function build(options: { assessment?: Record<string, unknown>; credential?: Record<string, unknown> | null; user?: Record<string, unknown> | null; rotateCount?: number; passwordError?: Error; active?: Array<{ id: string }> } = {}) {
  const prisma = {
    biometricCredential: {
      create: jest.fn().mockResolvedValue({ id: 'cred-new' }),
      findMany: jest.fn().mockResolvedValue(options.active ?? [{ id: 'cred-new' }]),
      findUnique: jest.fn().mockResolvedValue(options.credential === undefined ? null : options.credential),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: options.rotateCount ?? 1 }),
    },
  };
  const user = options.user === undefined ? { id: 'u1', accountType: AccountType.CUSTOMER, isActive: true, isSuspended: false } : options.user;
  const usersService = { findById: jest.fn().mockResolvedValue(user), updateLastLogin: jest.fn().mockResolvedValue(undefined) };
  const devicesService = { findOrCreateForLogin: jest.fn().mockResolvedValue({ id: 'dev1' }) };
  const accountAuth = {
    assertCurrentPassword: options.passwordError ? jest.fn().mockRejectedValue(options.passwordError) : jest.fn().mockResolvedValue(undefined),
    challengeUnknownDevice: jest.fn().mockResolvedValue({ requiresDeviceVerification: true, channel: 'EMAIL' }),
  };
  const authService = { issueTokens: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r', expiresIn: 900, user: { id: 'u1' } }) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const trustedDevices = {
    assess: jest.fn().mockResolvedValue(options.assessment ?? { verifyRequired: false, trust: { hasTrustedDevice: false, thisDeviceTrusted: false, offer: true } }),
  };
  const service = new BiometricAuthService(prisma as never, usersService as never, devicesService as never, accountAuth as never, authService as never, audit as never, trustedDevices as never);
  return { service, prisma, usersService, accountAuth, authService, audit, trustedDevices };
}

const stored = (extra: Record<string, unknown> = {}) => ({
  id: 'c1', userId: 'u1', tokenHash: hash('secret-courant'), previousTokenHash: null, rotatedAt: null, revokedAt: null, ...extra,
});
type LoggedIn = { accessToken: string; biometricToken: string };
/** Connexion normale : le résultat est typé « connecté » ; les cas « code demandé » appellent service.login directement. */
const login = (service: BiometricAuthService, token: string) =>
  service.login({ credentialId: 'c1', token }, { ipAddress: '1.2.3.4' }) as Promise<LoggedIn>;

describe('BiometricAuthService.enable', () => {
  it('vérifie le mot de passe, stocke seulement le hash du secret et renvoie le secret une seule fois', async () => {
    const { service, prisma, accountAuth } = build();
    const result = await service.enable('u1', { password: '482913', platform: 'android', label: ' Pixel 8 ' }, {});
    expect(accountAuth.assertCurrentPassword).toHaveBeenCalledWith('u1', '482913');
    expect(result.credentialId).toBe('cred-new');
    expect(result.token.length).toBeGreaterThanOrEqual(32);
    const data = prisma.biometricCredential.create.mock.calls[0][0].data;
    expect(data.tokenHash).toBe(hash(result.token));
    expect(JSON.stringify(data)).not.toContain(result.token);
    expect(data).toMatchObject({ userId: 'u1', platform: 'android', label: 'Pixel 8' });
  });

  it('mauvais mot de passe : refusé, aucun accès créé', async () => {
    const { service, prisma } = build({ passwordError: new BadRequestException('Mot de passe incorrect.') });
    await expect(service.enable('u1', { password: '000000' }, {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.biometricCredential.create).not.toHaveBeenCalled();
  });

  it('compte du back-office ou suspendu : refusé', async () => {
    await expect(build({ user: { id: 'u1', accountType: AccountType.SUPPORT, isActive: true, isSuspended: false } }).service.enable('u1', { password: '482913' }, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ user: { id: 'u1', accountType: AccountType.CUSTOMER, isActive: true, isSuspended: true } }).service.enable('u1', { password: '482913' }, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('au plus 5 téléphones : les plus anciens accès sont révoqués', async () => {
    const active = Array.from({ length: MAX_BIOMETRIC_DEVICES + 2 }, (_, i) => ({ id: `c${i}` }));
    const { service, prisma } = build({ active });
    await service.enable('u1', { password: '482913' }, {});
    expect(prisma.biometricCredential.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [`c${MAX_BIOMETRIC_DEVICES}`, `c${MAX_BIOMETRIC_DEVICES + 1}`] } },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('BiometricAuthService.login', () => {
  it('bon secret : session ouverte, nouveau secret renvoyé, ancien gardé en « précédent »', async () => {
    const { service, prisma, authService } = build({ credential: stored() });
    const result = await login(service, 'secret-courant');
    expect(result.accessToken).toBe('a');
    expect(result.biometricToken).toBeTruthy();
    expect(result.biometricToken).not.toBe('secret-courant');
    const call = prisma.biometricCredential.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'c1', revokedAt: null, tokenHash: hash('secret-courant') });
    expect(call.data).toMatchObject({ tokenHash: hash(result.biometricToken), previousTokenHash: hash('secret-courant') });
    expect(authService.issueTokens).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), expect.objectContaining({ deviceId: 'dev1', ipAddress: '1.2.3.4' }));
  });

  it('mauvais secret : refusé, rien n\'est révoqué', async () => {
    const { service, prisma, authService } = build({ credential: stored() });
    await expect(login(service, 'au-hasard')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.biometricCredential.update).not.toHaveBeenCalled();
    expect(authService.issueTokens).not.toHaveBeenCalled();
  });

  it('accès inconnu ou révoqué : refusé', async () => {
    await expect(login(build({ credential: null }).service, 'x'.repeat(40))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(login(build({ credential: stored({ revokedAt: new Date() }) }).service, 'secret-courant')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('ancien secret dans la minute qui suit le renouvellement (réponse perdue) : accepté', async () => {
    const credential = stored({ tokenHash: hash('secret-neuf'), previousTokenHash: hash('secret-courant'), rotatedAt: new Date(Date.now() - 5_000) });
    const { service, prisma } = build({ credential });
    await expect(login(service, 'secret-courant')).resolves.toMatchObject({ accessToken: 'a' });
    expect(prisma.biometricCredential.update).not.toHaveBeenCalled();
    expect(prisma.biometricCredential.updateMany.mock.calls[0][0].where).toMatchObject({ previousTokenHash: hash('secret-courant') });
  });

  it('ancien secret rejoué après la période de grâce : copie présumée, accès révoqué', async () => {
    const credential = stored({
      tokenHash: hash('secret-neuf'), previousTokenHash: hash('secret-courant'), rotatedAt: new Date(Date.now() - BIOMETRIC_ROTATION_GRACE_MS - 5_000),
    });
    const { service, prisma, audit, authService } = build({ credential });
    await expect(login(service, 'secret-courant')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.biometricCredential.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { revokedAt: expect.any(Date) } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'BIOMETRIC_REPLAY_REVOKED' }));
    expect(authService.issueTokens).not.toHaveBeenCalled();
  });

  it('compte suspendu ou désactivé : aucune session', async () => {
    for (const flags of [{ isSuspended: true, isActive: true }, { isSuspended: false, isActive: false }]) {
      const { service, authService } = build({ credential: stored(), user: { id: 'u1', accountType: AccountType.CUSTOMER, ...flags } });
      await expect(login(service, 'secret-courant')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authService.issueTokens).not.toHaveBeenCalled();
    }
  });

  it('deux demandes simultanées avec le même secret : la seconde perd la course et est refusée', async () => {
    const { service, authService } = build({ credential: stored(), rotateCount: 0 });
    await expect(login(service, 'secret-courant')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.issueTokens).not.toHaveBeenCalled();
  });
});

describe('BiometricAuthService.disable / list', () => {
  it('désactive uniquement un accès du compte connecté, avec trace', async () => {
    const { service, prisma, audit } = build();
    await service.disable('u1', 'c1', {});
    expect(prisma.biometricCredential.updateMany).toHaveBeenCalledWith({ where: { id: 'c1', userId: 'u1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'BIOMETRIC_DISABLED' }));
  });

  it('accès déjà révoqué ou d\'un autre compte : pas d\'erreur, pas de trace', async () => {
    const { service, audit } = build({ rotateCount: 0 });
    await expect(service.disable('u1', 'c-autre', {})).resolves.toBeUndefined();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('liste les téléphones actifs sans jamais exposer de secret', async () => {
    const { service, prisma } = build();
    await service.list('u1');
    const select = prisma.biometricCredential.findMany.mock.calls[0][0].select;
    expect(select).toEqual({ id: true, platform: true, label: true, createdAt: true, lastUsedAt: true });
  });
});

describe('BiometricAuthService.login — téléphones de confiance', () => {
  it('téléphone inconnu d\'un compte qui a un téléphone de confiance : un code est demandé, le secret n\'est pas renouvelé, aucune session', async () => {
    const { service, prisma, authService, accountAuth } = build({
      credential: stored(),
      assessment: { verifyRequired: true, trust: { hasTrustedDevice: true, thisDeviceTrusted: false, offer: true } },
    });
    const result = await login(service, 'secret-courant');
    expect(result).toMatchObject({ requiresDeviceVerification: true });
    expect(accountAuth.challengeUnknownDevice).toHaveBeenCalledWith('u1', { ipAddress: '1.2.3.4' });
    expect(prisma.biometricCredential.updateMany).not.toHaveBeenCalled();
    expect(authService.issueTokens).not.toHaveBeenCalled();
  });

  it('téléphone de confiance : connexion normale, avec l\'état de confiance', async () => {
    const trust = { hasTrustedDevice: true, thisDeviceTrusted: true, offer: false };
    const { service, trustedDevices } = build({ credential: stored(), assessment: { verifyRequired: false, trust } });
    const result = await service.login({ credentialId: 'c1', token: 'secret-courant', trustedDevice: { id: 'td1', secret: 'x'.repeat(40) } }, {});
    expect(result).toMatchObject({ accessToken: 'a', trust });
    expect(trustedDevices.assess).toHaveBeenCalledWith('u1', { id: 'td1', secret: 'x'.repeat(40) });
  });

  it('un mauvais secret d\'empreinte est refusé avant tout contrôle de confiance', async () => {
    const { service, trustedDevices } = build({ credential: stored() });
    await expect(login(service, 'mauvais')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(trustedDevices.assess).not.toHaveBeenCalled();
  });
});