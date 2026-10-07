// backend/src/auth/auth.service.otp-limit.spec.ts
// Limites des demandes de code SMS : par fenêtre, par jour et par numéro, et par jour pour toute la plateforme.
import { HttpException, HttpStatus } from '@nestjs/common';
import { OtpSettings } from '../otp/otp-settings.service';
import { AuthService } from './auth.service';

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

/** `counts` répond aux comptages dans l'ordre : fenêtre, puis jour (par numéro) ; le plafond global n'a qu'un comptage. */
function build(counts: number[]) {
  const queue = [...counts];
  const prisma = { otpCode: { count: jest.fn().mockImplementation(() => Promise.resolve(queue.shift() ?? 0)) } };
  const otpSettings = {
    assertPhoneAllowed: jest.fn(),
  };
  const filler = Array(9).fill({}) as [never, never, never, never, never, never, never, never, never];
  const service = new AuthService(prisma as never, ...filler, otpSettings as never);
  return { service, prisma, otpSettings };
}

const assertAllowed = (service: AuthService, userId: string, settings: Partial<OtpSettings> = {}) =>
  (service as unknown as { assertOtpRequestAllowed(id: string, s: OtpSettings): Promise<void> }).assertOtpRequestAllowed(
    userId,
    { ...SETTINGS, ...settings },
  );
const assertPlatform = (service: AuthService, phone: string, settings: Partial<OtpSettings> = {}) =>
  (service as unknown as { assertPlatformAllowsOtp(p: string, s: OtpSettings): Promise<void> }).assertPlatformAllowsOtp(
    phone,
    { ...SETTINGS, ...settings },
  );

describe('AuthService — limite de demandes de code par numéro', () => {
  it('laisse passer sous les limites', async () => {
    const { service } = build([4, 9]);
    await expect(assertAllowed(service, 'u1')).resolves.toBeUndefined();
  });

  it('refuse à partir de 5 demandes dans la fenêtre (429)', async () => {
    const { service } = build([5, 5]);
    await expect(assertAllowed(service, 'u1')).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    const again = build([5, 5]);
    await expect(assertAllowed(again.service, 'u1')).rejects.toBeInstanceOf(HttpException);
  });

  it('refuse à partir de 10 codes sur 24 h pour un même numéro (429), même si la fenêtre est libre', async () => {
    const { service } = build([0, 10]);
    await expect(assertAllowed(service, 'u1')).rejects.toThrow(/aujourd/);
  });

  it('plafond quotidien par numéro à 0 : illimité, et pas de comptage inutile', async () => {
    const { service, prisma } = build([0, 999]);
    await expect(assertAllowed(service, 'u1', { dailyLimitPerPhone: 0 })).resolves.toBeUndefined();
    expect(prisma.otpCode.count).toHaveBeenCalledTimes(1);
  });

  it('utilise la fenêtre et la limite des réglages, pas des valeurs figées', async () => {
    const { service } = build([2, 2]);
    await expect(assertAllowed(service, 'u1', { requestLimit: 2, requestWindowMinutes: 30 })).rejects.toThrow(/30 minutes/);
  });

  it('ne compte que les codes de connexion récents de ce numéro', async () => {
    const { service, prisma } = build([0, 0]);
    await assertAllowed(service, 'u1');
    for (const [call] of prisma.otpCode.count.mock.calls) {
      expect(call.where.userId).toBe('u1');
      expect(call.where.purpose).toBe('LOGIN');
      expect(call.where.createdAt.gte).toBeInstanceOf(Date);
    }
  });
});

describe('AuthService — garde-fous de la plateforme (avant création du compte)', () => {
  it('vérifie l’indicatif, puis laisse passer sous le plafond global', async () => {
    const { service, otpSettings } = build([1999]);
    await expect(assertPlatform(service, '+224620000001')).resolves.toBeUndefined();
    expect(otpSettings.assertPhoneAllowed).toHaveBeenCalledWith('+224620000001', expect.any(Object));
  });

  it('plafond global atteint : 503 clair', async () => {
    const { service } = build([2000]);
    await expect(assertPlatform(service, '+224620000001')).rejects.toMatchObject({ status: HttpStatus.SERVICE_UNAVAILABLE });
  });

  it('plafond global à 0 : illimité, aucun comptage', async () => {
    const { service, prisma } = build([99999]);
    await expect(assertPlatform(service, '+224620000001', { dailyLimitGlobal: 0 })).resolves.toBeUndefined();
    expect(prisma.otpCode.count).not.toHaveBeenCalled();
  });

  it('indicatif refusé : la vérification du plafond n’est même pas faite', async () => {
    const { service, prisma, otpSettings } = build([0]);
    otpSettings.assertPhoneAllowed.mockImplementation(() => {
      throw new HttpException('refusé', HttpStatus.BAD_REQUEST);
    });
    await expect(assertPlatform(service, '+1555')).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(prisma.otpCode.count).not.toHaveBeenCalled();
  });
});
