// backend/src/auth/phone-change.service.spec.ts
// Changement de numéro : code SMS envoyé au NOUVEAU numéro, adopté seulement après la bonne saisie.
import { BadRequestException, ConflictException, ForbiddenException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { AccountType, OtpStatus, Prisma } from '@prisma/client';
import { hashOtpCode } from '../common/utils/otp.util';
import { PhoneChangeService } from './phone-change.service';

const OLD = '+224620000001';
const NEW = '+224620000009';
const FUTURE = () => new Date(Date.now() + 5 * 60_000);

type Row = { id: string; userId: string; newPhone: string; codeHash: string; attempts: number; maxAttempts: number; expiresAt: Date; status: OtpStatus };

function build(options: {
  user?: Record<string, unknown> | null;
  owner?: unknown;
  pending?: Partial<Row> | null;
  recentByUser?: number;
  recentByPhone?: number;
  lastChange?: Date | null;
  smsFails?: boolean;
  updateFails?: unknown;
} = {}) {
  const user = options.user === undefined
    ? { id: 'u1', phone: OLD, accountType: AccountType.CUSTOMER, isSuspended: false }
    : options.user;
  const pending: Row | null = options.pending === null ? null : {
    id: 'r1', userId: 'u1', newPhone: NEW, codeHash: hashOtpCode('123456'), attempts: 0, maxAttempts: 3,
    expiresAt: FUTURE(), status: OtpStatus.PENDING, ...options.pending,
  };
  const tx = {
    user: { update: jest.fn().mockImplementation(() => (options.updateFails ? Promise.reject(options.updateFails) : Promise.resolve({}))) },
    phoneChangeRequest: { updateMany: jest.fn().mockResolvedValue({}), update: jest.fn().mockResolvedValue({}) },
    customerProfile: { findUnique: jest.fn().mockResolvedValue({ id: 'cp1' }) },
    shipment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    phoneChangeRequest: {
      count: jest.fn().mockImplementation(({ where }) => Promise.resolve('userId' in where ? (options.recentByUser ?? 0) : (options.recentByPhone ?? 0))),
      findFirst: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(where.status === OtpStatus.VERIFIED ? (options.lastChange ? { verifiedAt: options.lastChange } : null) : pending),
      ),
      updateMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'r-new' }),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const config = { get: jest.fn().mockImplementation((key: string) => (key === 'otp.expirySeconds' ? 300 : 3)) };
  const users = {
    findById: jest.fn().mockResolvedValue(user),
    findByPhone: jest.fn().mockResolvedValue(options.owner ?? null),
    getSafeById: jest.fn().mockResolvedValue({ id: 'u1', phone: NEW }),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const sms = {
    send: jest.fn().mockImplementation(() => (options.smsFails ? Promise.reject(new Error('gateway down')) : Promise.resolve())),
  };
  const service = new PhoneChangeService(prisma as never, config as never, users as never, audit as never, sms as never);
  return { service, prisma, tx, users, audit, sms };
}

afterEach(() => {
  delete process.env.AUTH_TEST_MODE_ENABLED;
  delete process.env.AUTH_TEST_PHONE_NUMBERS;
  delete process.env.PHONE_CHANGE_COOLDOWN_DAYS;
});

describe('PhoneChangeService.request — étape 1', () => {
  it('envoie le code par SMS au NOUVEAU numéro et en garde seulement le hash', async () => {
    const { service, prisma, sms } = build();
    const result = await service.request('u1', NEW);
    expect(result).toEqual({ expiresInSeconds: 300 });
    expect(sms.send).toHaveBeenCalledTimes(1);
    expect(sms.send.mock.calls[0][0]).toBe(NEW);
    const sentCode = /(\d{6})/.exec(sms.send.mock.calls[0][1])?.[1] as string;
    const stored = prisma.phoneChangeRequest.create.mock.calls[0][0].data;
    expect(stored).toMatchObject({ userId: 'u1', oldPhone: OLD, newPhone: NEW });
    expect(stored.codeHash).toBe(hashOtpCode(sentCode));
    expect(JSON.stringify(stored)).not.toContain(sentCode);
  });

  it('annule les codes précédents encore valables : un seul code à la fois', async () => {
    const { service, prisma } = build();
    await service.request('u1', NEW);
    expect(prisma.phoneChangeRequest.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', status: OtpStatus.PENDING },
      data: { status: OtpStatus.EXPIRED },
    });
  });

  it('refuse le numéro actuel, un numéro déjà pris, un compte suspendu et un compte équipe', async () => {
    await expect(build().service.request('u1', OLD)).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ owner: { id: 'other' } }).service.request('u1', NEW)).rejects.toBeInstanceOf(ConflictException);
    await expect(build({ user: { id: 'u1', phone: OLD, accountType: AccountType.CUSTOMER, isSuspended: true } }).service.request('u1', NEW)).rejects.toBeInstanceOf(BadRequestException);
    await expect(build({ user: { id: 'u1', phone: OLD, accountType: AccountType.SUPPORT, isSuspended: false } }).service.request('u1', NEW)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('un numéro refusé ne déclenche aucun SMS', async () => {
    const { service, sms } = build({ owner: { id: 'other' } });
    await expect(service.request('u1', NEW)).rejects.toBeInstanceOf(ConflictException);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('limite les envois par compte ET par numéro destinataire (429)', async () => {
    await expect(build({ recentByUser: 5 }).service.request('u1', NEW)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    await expect(build({ recentByPhone: 5 }).service.request('u1', NEW)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    await expect(build({ recentByUser: 4, recentByPhone: 4 }).service.request('u1', NEW)).resolves.toBeDefined();
  });

  it('délai entre deux changements : refus tant que les 30 jours ne sont pas écoulés', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    await expect(build({ lastChange: tenDaysAgo }).service.request('u1', NEW)).rejects.toThrow(/changé de numéro récemment/);
    const fortyDaysAgo = new Date(Date.now() - 40 * 86_400_000);
    await expect(build({ lastChange: fortyDaysAgo }).service.request('u1', NEW)).resolves.toBeDefined();
  });

  it('PHONE_CHANGE_COOLDOWN_DAYS=0 désactive le délai', async () => {
    process.env.PHONE_CHANGE_COOLDOWN_DAYS = '0';
    await expect(build({ lastChange: new Date() }).service.request('u1', NEW)).resolves.toBeDefined();
  });

  it('échec du SMS : 503 clair, demande marquée échouée', async () => {
    const { service, prisma } = build({ smsFails: true });
    await expect(service.request('u1', NEW)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.phoneChangeRequest.update).toHaveBeenCalledWith({ where: { id: 'r-new' }, data: { status: OtpStatus.FAILED } });
  });

  it('mode test : numéro listé = code 000000 sans SMS ; ailleurs, parcours normal', async () => {
    process.env.AUTH_TEST_MODE_ENABLED = 'true';
    process.env.AUTH_TEST_PHONE_NUMBERS = NEW;
    const test = build();
    await test.service.request('u1', NEW);
    expect(test.sms.send).not.toHaveBeenCalled();
    expect(test.prisma.phoneChangeRequest.create.mock.calls[0][0].data.codeHash).toBe(hashOtpCode('000000'));

    const other = build();
    await other.service.request('u1', '+224620000010');
    expect(other.sms.send).toHaveBeenCalled();
  });

  it('mode test désactivé : un numéro listé suit le parcours normal', async () => {
    process.env.AUTH_TEST_PHONE_NUMBERS = NEW; // sans AUTH_TEST_MODE_ENABLED
    const { service, sms } = build();
    await service.request('u1', NEW);
    expect(sms.send).toHaveBeenCalled();
  });
});

describe('PhoneChangeService.confirm — étape 2', () => {
  it('bon code : le compte prend le nouveau numéro, vérifié, et la demande est consommée', async () => {
    const { service, tx, users } = build();
    const user = await service.confirm('u1', NEW, '123456', { ipAddress: '1.2.3.4' });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { phone: NEW, isPhoneVerified: true } });
    expect(tx.phoneChangeRequest.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'r1' }, data: expect.objectContaining({ status: OtpStatus.VERIFIED }) }));
    expect(users.getSafeById).toHaveBeenCalledWith('u1');
    expect(user).toMatchObject({ phone: NEW });
  });

  it('les envois pas encore récupérés suivent le nouveau numéro (code de récupération), les autres non', async () => {
    const { service, tx } = build();
    await service.confirm('u1', NEW, '123456');
    const call = tx.shipment.updateMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ customerId: 'cp1', senderPhone: OLD });
    expect(call.where.status.in).toEqual(['SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'PICKUP_PENDING']);
    expect(call.data).toEqual({ senderPhone: NEW });
  });

  it('journalise le changement et prévient l\'ANCIEN numéro par SMS', async () => {
    const { service, audit, sms } = build();
    await service.confirm('u1', NEW, '123456', { ipAddress: '1.2.3.4' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PHONE_CHANGED', entityId: 'u1', diff: { oldPhone: OLD, newPhone: NEW }, ipAddress: '1.2.3.4' }));
    expect(sms.send).toHaveBeenCalledWith(OLD, expect.stringContaining('remplacé'));
  });

  it('l\'échec du SMS vers l\'ancien numéro ne fait pas échouer le changement', async () => {
    const { service } = build({ smsFails: true });
    await expect(service.confirm('u1', NEW, '123456')).resolves.toBeDefined();
  });

  it('mauvais code : compté, avec le nombre d\'essais restants ; le numéro ne change pas', async () => {
    const { service, prisma, tx } = build();
    await expect(service.confirm('u1', NEW, '999999')).rejects.toThrow(/2 essais restants/);
    expect(prisma.phoneChangeRequest.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { attempts: 1 } });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('3e mauvais essai : la demande est bloquée', async () => {
    const { service, prisma } = build({ pending: { attempts: 2 } });
    await expect(service.confirm('u1', NEW, '999999')).rejects.toThrow(/demandez un nouveau code/);
    expect(prisma.phoneChangeRequest.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { attempts: 3, status: OtpStatus.FAILED } });
  });

  it('demande déjà épuisée, expirée ou absente : refusé sans toucher au compte', async () => {
    const exhausted = build({ pending: { attempts: 3 } });
    await expect(exhausted.service.confirm('u1', NEW, '123456')).rejects.toThrow(/Trop de tentatives/);
    const expired = build({ pending: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(expired.service.confirm('u1', NEW, '123456')).rejects.toThrow(/expiré/);
    const none = build({ pending: null });
    await expect(none.service.confirm('u1', NEW, '123456')).rejects.toThrow(/expiré ou introuvable/);
    for (const { tx } of [exhausted, expired, none]) expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('le code est lié au numéro : une demande vers un autre numéro ne valide pas celui-ci', async () => {
    const { service, prisma } = build();
    await service.confirm('u1', NEW, '123456');
    expect(prisma.phoneChangeRequest.findFirst.mock.calls[0][0].where).toMatchObject({ userId: 'u1', newPhone: NEW, status: OtpStatus.PENDING });
  });

  it('numéro pris entre-temps par un autre compte (contrainte d\'unicité) : 409', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
    const { service } = build({ updateFails: conflict });
    await expect(service.confirm('u1', NEW, '123456')).rejects.toBeInstanceOf(ConflictException);
  });

  it('compte suspendu : refusé', async () => {
    const { service } = build({ user: { id: 'u1', phone: OLD, accountType: AccountType.CUSTOMER, isSuspended: true } });
    await expect(service.confirm('u1', NEW, '123456')).rejects.toBeInstanceOf(BadRequestException);
  });
});
