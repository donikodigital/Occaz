// backend/src/otp/otp.service.spec.ts
// Codes de remise (prise en charge, dépose, colis) : génération, SMS en « meilleur effort », plafond de SMS, vérification.
import { UnauthorizedException } from '@nestjs/common';
import { OtpPurpose, OtpStatus } from '@prisma/client';
import { hashOtpCode } from '../common/utils/otp.util';
import { OtpService } from './otp.service';
import { OtpSettings } from './otp-settings.service';

const SETTINGS: OtpSettings = {
  expirySeconds: 300,
  maxAttempts: 3,
  requestLimit: 5,
  requestWindowMinutes: 15,
  dailyLimitPerPhone: 10,
  dailyLimitGlobal: 2000,
  handoverSmsDailyLimit: 5,
  allowedPhonePrefixes: [],
  phoneChangeCooldownDays: 30,
  notificationSmsDailyLimitPerUser: 10,
};
const PARAMS = { purpose: OtpPurpose.TRIP_PICKUP, phone: '+224620000001', bookingId: 'b1' };
const FUTURE = () => new Date(Date.now() + 5 * 60_000);

type Row = { id: string; code: string; attempts: number; maxAttempts: number; expiresAt: Date; status: OtpStatus };
const row = (id: string, code: string, extra: Partial<Row> = {}): Row => ({
  id,
  code: hashOtpCode(code),
  attempts: 0,
  maxAttempts: 3,
  expiresAt: FUTURE(),
  status: OtpStatus.PENDING,
  ...extra,
});

function build(options: {
  sentToday?: number;
  smsFails?: boolean;
  settings?: Partial<OtpSettings>;
  candidates?: Row[];
  /** Réponses successives (nombre de lignes modifiées) de updateMany : 1re = essai consommé, 2e = code consommé. */
  updateManyCounts?: number[];
} = {}) {
  const updateManyCounts = [...(options.updateManyCounts ?? [])];
  const prisma = {
    otpCode: {
      count: jest.fn().mockResolvedValue(options.sentToday ?? 0),
      create: jest.fn().mockResolvedValue({ id: 'new' }),
      findMany: jest.fn().mockResolvedValue(options.candidates ?? []),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockImplementation(() => Promise.resolve({ count: updateManyCounts.shift() ?? 1 })),
    },
  };
  const otpSettings = { get: jest.fn().mockResolvedValue({ ...SETTINGS, ...options.settings }) };
  const sms = {
    send: jest.fn().mockImplementation(() => (options.smsFails ? Promise.reject(new Error('gateway down')) : Promise.resolve())),
  };
  const service = new OtpService(prisma as never, otpSettings as never, sms as never);
  return { service, prisma, sms };
}

describe('OtpService.generateAndSend', () => {
  it('stocke seulement le hash, envoie le SMS et ne renvoie pas le code par défaut', async () => {
    const { service, prisma, sms } = build();
    const result = await service.generateAndSend(PARAMS, 'Votre code :');
    expect(result).toEqual({ expiresInSeconds: 300, code: undefined, smsSent: true });
    const sentCode = /(\d{6})$/.exec(sms.send.mock.calls[0][1])?.[1] as string;
    expect(sms.send.mock.calls[0][0]).toBe(PARAMS.phone);
    const stored = prisma.otpCode.create.mock.calls[0][0].data;
    expect(stored.code).toBe(hashOtpCode(sentCode));
    expect(JSON.stringify(stored)).not.toContain(sentCode);
  });

  it('revealCodeToCaller : le code en clair est renvoyé (bénéficiaire uniquement), toujours haché en base', async () => {
    const { service, prisma } = build();
    const result = await service.generateAndSend(PARAMS, 'Votre code :', { revealCodeToCaller: true });
    expect(result.code).toMatch(/^\d{6}$/);
    expect(prisma.otpCode.create.mock.calls[0][0].data.code).toBe(hashOtpCode(result.code as string));
  });

  it('utilise la durée et le nombre d\'essais des réglages', async () => {
    const { service, prisma } = build({ settings: { expirySeconds: 120, maxAttempts: 5 } });
    const result = await service.generateAndSend(PARAMS, 'Votre code :');
    expect(result.expiresInSeconds).toBe(120);
    expect(prisma.otpCode.create.mock.calls[0][0].data.maxAttempts).toBe(5);
  });

  it('échec du SMS : le code existe quand même (visible dans l\'application), smsSent=false, aucune exception', async () => {
    const { service, prisma } = build({ smsFails: true });
    const result = await service.generateAndSend(PARAMS, 'Votre code :', { revealCodeToCaller: true });
    expect(result.smsSent).toBe(false);
    expect(result.code).toMatch(/^\d{6}$/);
    expect(prisma.otpCode.create).toHaveBeenCalledTimes(1);
  });

  it('sous le plafond de SMS de remise : le SMS part', async () => {
    const { service, sms } = build({ sentToday: 4 });
    expect((await service.generateAndSend(PARAMS, 'Votre code :')).smsSent).toBe(true);
    expect(sms.send).toHaveBeenCalledTimes(1);
  });

  it('plafond de SMS de remise atteint : AUCUN SMS, mais le code est créé et renvoyé au bénéficiaire', async () => {
    const { service, sms, prisma } = build({ sentToday: 5 });
    const result = await service.generateAndSend(PARAMS, 'Votre code :', { revealCodeToCaller: true });
    expect(sms.send).not.toHaveBeenCalled();
    expect(result.smsSent).toBe(false);
    expect(result.code).toMatch(/^\d{6}$/);
    expect(prisma.otpCode.create).toHaveBeenCalledTimes(1);
  });

  it('le plafond se compte par réservation (ou envoi), par étape, sur 24 h', async () => {
    const { service, prisma } = build();
    await service.generateAndSend(PARAMS, 'Votre code :');
    const where = prisma.otpCode.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ purpose: OtpPurpose.TRIP_PICKUP, bookingId: 'b1' });
    const age = Date.now() - where.createdAt.gte.getTime();
    expect(age).toBeGreaterThan(23.9 * 3_600_000);
    expect(age).toBeLessThan(24.1 * 3_600_000);
  });

  it('plafond à 0 : illimité, sans comptage', async () => {
    const { service, sms, prisma } = build({ sentToday: 999, settings: { handoverSmsDailyLimit: 0 } });
    expect((await service.generateAndSend(PARAMS, 'Votre code :')).smsSent).toBe(true);
    expect(prisma.otpCode.count).not.toHaveBeenCalled();
    expect(sms.send).toHaveBeenCalled();
  });
});

describe('OtpService.verify', () => {
  const verifyParams = { purpose: OtpPurpose.TRIP_PICKUP, bookingId: 'b1' };

  it('bon code : le lot est invalidé et le code marqué vérifié', async () => {
    const { service, prisma } = build({ candidates: [row('c1', '123456'), row('c0', '654321')] });
    await expect(service.verify({ ...verifyParams, code: '123456' })).resolves.toBeUndefined();
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1', status: OtpStatus.PENDING },
        data: expect.objectContaining({ status: OtpStatus.VERIFIED }),
      }),
    );
    // Le reste du lot est invalidé, mais pas le code validé.
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['c0'] }, status: OtpStatus.PENDING } }),
    );
  });

  it('accepte un code récent même si un code plus récent a été généré depuis (fenêtre de tolérance)', async () => {
    const { service } = build({ candidates: [row('c2', '111111'), row('c1', '222222')] });
    await expect(service.verify({ ...verifyParams, code: '222222' })).resolves.toBeUndefined();
  });

  it('mauvais code : essai compté sur le code le plus récent, 401', async () => {
    const { service, prisma } = build({ candidates: [row('c1', '123456')] });
    await expect(service.verify({ ...verifyParams, code: '000000' })).rejects.toThrow('Code invalide.');
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', status: OtpStatus.PENDING, attempts: { lt: 3 } },
      data: { attempts: { increment: 1 } },
    });
  });

  it('essais consommés en parallèle : l\'essai atomique est refusé, même avec le bon code', async () => {
    const { service, prisma } = build({ candidates: [row('c1', '123456', { attempts: 2 })], updateManyCounts: [0] });
    await expect(service.verify({ ...verifyParams, code: '123456' })).rejects.toThrow(/Trop de tentatives/);
    expect(prisma.otpCode.updateMany).toHaveBeenCalledTimes(1);
  });

  it('usage unique : un bon code déjà consommé par une requête parallèle est refusé', async () => {
    const { service } = build({ candidates: [row('c1', '123456')], updateManyCounts: [1, 0] });
    await expect(service.verify({ ...verifyParams, code: '123456' })).rejects.toThrow(/déjà été utilisé/);
  });

  it('essais épuisés : le code est bloqué, même avec le bon code', async () => {
    const { service, prisma } = build({ candidates: [row('c1', '123456', { attempts: 3 })] });
    await expect(service.verify({ ...verifyParams, code: '123456' })).rejects.toThrow(/Trop de tentatives/);
    expect(prisma.otpCode.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { status: OtpStatus.FAILED } });
  });

  it('code expiré ou absent : 401 explicite', async () => {
    await expect(build({ candidates: [] }).service.verify({ ...verifyParams, code: '123456' })).rejects.toBeInstanceOf(UnauthorizedException);
    const expired = build({ candidates: [row('c1', '123456', { expiresAt: new Date(Date.now() - 1000) })] });
    await expect(expired.service.verify({ ...verifyParams, code: '123456' })).rejects.toThrow(/expiré/);
  });
});
