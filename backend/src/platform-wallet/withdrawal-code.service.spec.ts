// backend/src/platform-wallet/withdrawal-code.service.spec.ts
// Code de retrait du SuperAdmin envoyé par e-mail : lié au retrait, 3 essais, usage unique, un seul code actif, 5 envois/heure.
import { BadRequestException, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { OtpPurpose, OtpStatus } from '@prisma/client';
import { hashOtpCode } from '../common/utils/otp.util';
import { WithdrawalCodeService } from './withdrawal-code.service';

const TARGET = { beneficiaryId: 'b1', currencyId: 'xof', amount: 5000n };
const SUMMARY = { beneficiaryLabel: 'Mon Orange Money', isoCode: 'XOF' };

type Row = { id: string; code: string; attempts: number; maxAttempts: number; status: OtpStatus; target: string; expiresAt: Date };

function build(options: { email?: string | null; sentLastHour?: number; emailFails?: boolean; row?: Partial<Row> | null; usedCount?: number } = {}) {
  const row: Row | null = options.row === null ? null : {
    id: 'o1', code: hashOtpCode('123456'), attempts: 0, maxAttempts: 3, status: OtpStatus.PENDING,
    target: 'withdrawal:b1:xof:5000', expiresAt: new Date(Date.now() + 5 * 60_000), ...options.row,
  };
  let updateManyCall = 0;
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: options.email === undefined ? 'admin@occaz.sarl' : options.email }) },
    otpCode: {
      count: jest.fn().mockResolvedValue(options.sentLastHour ?? 0),
      updateMany: jest.fn().mockImplementation(() => {
        updateManyCall += 1;
        return Promise.resolve({ count: 1 });
      }),
      create: jest.fn().mockResolvedValue({ id: 'o-new' }),
      delete: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(row),
    },
  };
  const email = { send: jest.fn().mockImplementation(() => (options.emailFails ? Promise.reject(new Error('resend down')) : Promise.resolve())) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new WithdrawalCodeService(prisma as never, audit as never, email as never), prisma, email, audit, calls: () => updateManyCall };
}

describe('WithdrawalCodeService.send', () => {
  afterEach(() => {
    delete process.env.AUTH_TEST_MODE_ENABLED;
    delete process.env.AUTH_TEST_STAFF_EMAILS;
  });

  it('envoie par e-mail un code à 6 chiffres qui décrit le retrait, et ne garde que le hash lié au retrait', async () => {
    const { service, email, prisma } = build();
    const result = await service.send('u1', TARGET, SUMMARY);
    expect(result.expiresInSeconds).toBe(600);
    expect(result.sentTo).not.toContain('admin@occaz.sarl');
    const [to, , body] = email.send.mock.calls[0];
    expect(to).toBe('admin@occaz.sarl');
    const code = /est (\d{6})/.exec(body)?.[1] as string;
    expect(body).toContain('5');
    expect(body).toContain('Mon Orange Money');
    const data = prisma.otpCode.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'u1', purpose: OtpPurpose.WITHDRAWAL, target: 'withdrawal:b1:xof:5000', maxAttempts: 3 });
    expect(data.code).toBe(hashOtpCode(code));
    expect(JSON.stringify(data)).not.toContain(code);
  });

  it('annule les codes précédents : un seul code actif', async () => {
    const { service, prisma } = build();
    await service.send('u1', TARGET, SUMMARY);
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', purpose: OtpPurpose.WITHDRAWAL, status: OtpStatus.PENDING }, data: { status: OtpStatus.EXPIRED } });
  });

  it('5 envois par heure au plus (429)', async () => {
    const { service, email } = build({ sentLastHour: 5 });
    await expect(service.send('u1', TARGET, SUMMARY)).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('compte sans e-mail : 400', async () => {
    await expect(build({ email: null }).service.send('u1', TARGET, SUMMARY)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('e-mail non parti : 503 et le code inutile est supprimé', async () => {
    const { service, prisma } = build({ emailFails: true });
    await expect(service.send('u1', TARGET, SUMMARY)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.otpCode.delete).toHaveBeenCalledWith({ where: { id: 'o-new' } });
  });

  it('compte de test en mode test : code 000000, aucun e-mail', async () => {
    process.env.AUTH_TEST_MODE_ENABLED = 'true';
    process.env.AUTH_TEST_STAFF_EMAILS = 'admin@occaz.sarl';
    const { service, email, prisma } = build();
    await service.send('u1', TARGET, SUMMARY);
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.otpCode.create.mock.calls[0][0].data.code).toBe(hashOtpCode('000000'));
  });
});

describe('WithdrawalCodeService.consume', () => {
  it('bon code pour ce retrait : consommé (PENDING -> VERIFIED)', async () => {
    const { service, prisma } = build();
    await expect(service.consume('u1', TARGET, '123456')).resolves.toBeUndefined();
    expect(prisma.otpCode.findFirst.mock.calls[0][0].where.target).toBe('withdrawal:b1:xof:5000');
    expect(prisma.otpCode.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'o1', status: OtpStatus.PENDING },
      data: { status: OtpStatus.VERIFIED, verifiedAt: expect.any(Date) },
    });
  });

  it('autre montant => autre cible => aucun code valable', async () => {
    const { service, prisma } = build({ row: null });
    await expect(service.consume('u1', { ...TARGET, amount: 900000n }, '123456')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.otpCode.findFirst.mock.calls[0][0].where.target).toBe('withdrawal:b1:xof:900000');
  });

  it('mauvais code : 400 avec le nombre d\'essais restants, essai compté', async () => {
    const { service, prisma } = build();
    await expect(service.consume('u1', TARGET, '000111')).rejects.toThrow(/2 essais/);
    expect(prisma.otpCode.updateMany.mock.calls[0][0].data).toEqual({ attempts: { increment: 1 } });
  });

  it('3e mauvais essai : le code est annulé', async () => {
    const { service, prisma } = build({ row: { attempts: 2 } });
    await expect(service.consume('u1', TARGET, '000111')).rejects.toThrow(/Trop d/);
    expect(prisma.otpCode.updateMany).toHaveBeenLastCalledWith({ where: { id: 'o1', status: OtpStatus.PENDING }, data: { status: OtpStatus.EXPIRED } });
  });

  it('format invalide : refusé sans deviner', async () => {
    await expect(build().service.consume('u1', TARGET, 'abc')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeu : deuxième utilisation du même code refusée', async () => {
    const { service, prisma } = build();
    prisma.otpCode.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await expect(service.consume('u1', TARGET, '123456')).rejects.toThrow(/déjà été utilisé/);
  });
});
