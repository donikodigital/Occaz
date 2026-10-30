// backend/src/auth/trusted-device.service.spec.ts
// Téléphones de confiance : évaluation à la connexion, enregistrement (secret renvoyé une fois, hash seul stocké), plafond de 5, retrait.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { createHash } from 'crypto';
import { MAX_TRUSTED_DEVICES, TrustedDeviceService } from './trusted-device.service';

const hash = (secret: string) => createHash('sha256').update(secret).digest('hex');
const SECRET = 's'.repeat(43);

type Row = Record<string, unknown>;

function build(options: { active?: Row[]; user?: Row | null; emailError?: Error } = {}) {
  const active = options.active ?? [];
  const prisma = {
    trustedDevice: {
      count: jest.fn().mockResolvedValue(active.length),
      findFirst: jest.fn(async ({ where }: { where: Row }) => active.find((row) => row.id === where.id) ?? null),
      create: jest.fn(async ({ data }: { data: Row }) => ({ id: 'td-new', ...data })),
      findMany: jest.fn().mockResolvedValue(active),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const user =
    options.user === undefined
      ? { id: 'u1', phone: '+224620000010', accountType: AccountType.CUSTOMER, isActive: true, isSuspended: false, email: 'f@exemple.com', isEmailVerified: true }
      : options.user;
  const usersService = { findById: jest.fn().mockResolvedValue(user) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const email = { send: options.emailError ? jest.fn().mockRejectedValue(options.emailError) : jest.fn().mockResolvedValue(undefined) };
  const service = new TrustedDeviceService(prisma as never, usersService as never, audit as never, email as never);
  return { service, prisma, audit, email, usersService };
}

describe('TrustedDeviceService.assess', () => {
  it('aucun téléphone de confiance : connexion libre, et on propose d’en enregistrer un', async () => {
    const { service } = build();
    await expect(service.assess('u1')).resolves.toEqual({
      verifyRequired: false,
      trust: { hasTrustedDevice: false, thisDeviceTrusted: false, offer: true },
    });
  });

  it('le bon secret : téléphone de confiance reconnu, pas de code, pas de nouvelle question', async () => {
    const { service, prisma } = build({ active: [{ id: 'td1', secretHash: hash(SECRET) }] });
    const result = await service.assess('u1', { id: 'td1', secret: SECRET });
    expect(result).toEqual({ verifyRequired: false, trust: { hasTrustedDevice: true, thisDeviceTrusted: true, offer: false } });
    expect(prisma.trustedDevice.updateMany).toHaveBeenCalledWith({ where: { id: 'td1', revokedAt: null }, data: { lastUsedAt: expect.any(Date) } });
  });

  it('mauvais secret, identifiant inconnu ou rien de présenté : un code est exigé', async () => {
    const { service } = build({ active: [{ id: 'td1', secretHash: hash(SECRET) }] });
    const expected = { verifyRequired: true, trust: { hasTrustedDevice: true, thisDeviceTrusted: false, offer: true } };
    await expect(service.assess('u1', { id: 'td1', secret: 'x'.repeat(43) })).resolves.toEqual(expected);
    await expect(service.assess('u1', { id: 'td-autre', secret: SECRET })).resolves.toEqual(expected);
    await expect(service.assess('u1')).resolves.toEqual(expected);
  });

  it('la recherche est faite parmi les téléphones non retirés de CE compte', async () => {
    const { service, prisma } = build({ active: [{ id: 'td1', secretHash: hash(SECRET) }] });
    await service.assess('u1', { id: 'td1', secret: SECRET });
    expect(prisma.trustedDevice.findFirst).toHaveBeenCalledWith({ where: { id: 'td1', userId: 'u1', revokedAt: null } });
  });
});

describe('TrustedDeviceService.register', () => {
  it('stocke seulement le hash du secret, renvoie le secret une fois, journalise et prévient par e-mail', async () => {
    const { service, prisma, audit, email } = build({ active: [{ id: 'td-new' }] });
    const result = await service.register('u1', { platform: 'android', label: ' Pixel 8 ' }, { ipAddress: '1.2.3.4' });
    expect(result.id).toBe('td-new');
    expect(result.secret.length).toBeGreaterThanOrEqual(32);
    const data = (prisma.trustedDevice.create.mock.calls[0]![0] as { data: Row }).data;
    expect(data.secretHash).toBe(hash(result.secret));
    expect(JSON.stringify(data)).not.toContain(result.secret);
    expect(data).toMatchObject({ userId: 'u1', platform: 'android', label: 'Pixel 8' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TRUSTED_DEVICE_ADDED', actorId: 'u1' }));
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('au plus 5 : les moins récemment utilisés sont retirés, jamais le nouveau', async () => {
    const active = [{ id: 'td-new' }, ...Array.from({ length: MAX_TRUSTED_DEVICES + 1 }, (_, i) => ({ id: `t${i}` }))];
    const { service, prisma } = build({ active });
    await service.register('u1', {}, {});
    const surplus = [`t${MAX_TRUSTED_DEVICES - 1}`, `t${MAX_TRUSTED_DEVICES}`];
    expect(prisma.trustedDevice.updateMany).toHaveBeenCalledWith({ where: { id: { in: surplus } }, data: { revokedAt: expect.any(Date) } });
  });

  it('sous le plafond : rien n’est retiré', async () => {
    const { service, prisma } = build({ active: [{ id: 'td-new' }, { id: 't0' }] });
    await service.register('u1', {}, {});
    expect(prisma.trustedDevice.updateMany).not.toHaveBeenCalled();
  });

  it('l’alerte e-mail en échec ne bloque pas l’enregistrement', async () => {
    const { service } = build({ active: [{ id: 'td-new' }], emailError: new Error('Resend HS') });
    await expect(service.register('u1', {}, {})).resolves.toMatchObject({ id: 'td-new' });
  });

  it('numéro de test ou e-mail non vérifié : aucune alerte envoyée', async () => {
    const test = build({
      active: [{ id: 'td-new' }],
      user: { id: 'u1', phone: '+224600000001', accountType: AccountType.CUSTOMER, isActive: true, isSuspended: false, email: 'f@exemple.com', isEmailVerified: true },
    });
    process.env.AUTH_TEST_MODE_ENABLED = 'true';
    process.env.AUTH_TEST_PHONE_NUMBERS = '+224600000001';
    await test.service.register('u1', {}, {});
    expect(test.email.send).not.toHaveBeenCalled();
    delete process.env.AUTH_TEST_MODE_ENABLED;
    delete process.env.AUTH_TEST_PHONE_NUMBERS;

    const unverified = build({
      active: [{ id: 'td-new' }],
      user: { id: 'u1', phone: '+224620000010', accountType: AccountType.CUSTOMER, isActive: true, isSuspended: false, email: 'f@exemple.com', isEmailVerified: false },
    });
    await unverified.service.register('u1', {}, {});
    expect(unverified.email.send).not.toHaveBeenCalled();
  });

  it('compte du back-office, suspendu ou inconnu : refusé, rien n’est créé', async () => {
    for (const user of [
      { id: 'u1', accountType: AccountType.SUPPORT, isActive: true, isSuspended: false },
      { id: 'u1', accountType: AccountType.CUSTOMER, isActive: true, isSuspended: true },
      null,
    ]) {
      const { service, prisma } = build({ user });
      await expect(service.register('u1', {}, {})).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.trustedDevice.create).not.toHaveBeenCalled();
    }
  });
});

describe('TrustedDeviceService.list / revoke', () => {
  it('la liste ne contient que les téléphones non retirés, sans jamais exposer le hash', async () => {
    const { service, prisma } = build();
    await service.list('u1');
    const args = prisma.trustedDevice.findMany.mock.calls[0]![0] as { where: Row; select: Row };
    expect(args.where).toEqual({ userId: 'u1', revokedAt: null });
    expect(args.select).not.toHaveProperty('secretHash');
  });

  it('retirer un téléphone le révoque et le journalise', async () => {
    const { service, prisma, audit } = build();
    await service.revoke('u1', 'td1', { ipAddress: '1.2.3.4' });
    expect(prisma.trustedDevice.updateMany).toHaveBeenCalledWith({ where: { id: 'td1', userId: 'u1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TRUSTED_DEVICE_REMOVED' }));
  });

  it('un téléphone inconnu, déjà retiré ou d’un autre compte : introuvable', async () => {
    const { service, prisma, audit } = build();
    prisma.trustedDevice.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.revoke('u1', 'td-x', {})).rejects.toBeInstanceOf(NotFoundException);
    expect(audit.log).not.toHaveBeenCalled();
  });
});
