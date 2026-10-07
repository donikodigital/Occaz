// backend/src/auth/auth.service.otp-login.spec.ts
// Connexion par code SMS : demande (échec du SMS, indicatifs, plafonds, mode test) et vérification du code.
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AccountType, OtpPurpose, OtpStatus } from '@prisma/client';
import { hashOtpCode } from '../common/utils/otp.util';
import { OtpSettings, OtpSettingsService } from '../otp/otp-settings.service';
import { AuthService } from './auth.service';

const PHONE = '+224620000001';
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
const USER = { id: 'u1', phone: PHONE, accountType: AccountType.CUSTOMER, isSuspended: false, isPhoneVerified: true };
const FUTURE = () => new Date(Date.now() + 5 * 60_000);

function build(
  options: {
    user?: Record<string, unknown> | null;
    counts?: number[];
    smsFails?: boolean;
    settings?: Partial<OtpSettings>;
    otp?: Record<string, unknown> | null;
    /** Réponses successives (lignes modifiées) de updateMany : 1re = essai consommé, 2e = code consommé. */
    updateManyCounts?: number[];
  } = {},
) {
  const updateManyCounts = [...(options.updateManyCounts ?? [])];
  const counts = [...(options.counts ?? [])];
  const settings = { ...SETTINGS, ...options.settings };
  const prisma = {
    otpCode: {
      count: jest.fn().mockImplementation(() => Promise.resolve(counts.shift() ?? 0)),
      create: jest.fn().mockResolvedValue({ id: 'otp-new' }),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockImplementation(() => Promise.resolve({ count: updateManyCounts.shift() ?? 1 })),
      findFirst: jest.fn().mockResolvedValue(options.otp ?? null),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
  };
  const users = {
    findByEmail: jest.fn().mockResolvedValue(options.user === undefined ? USER : options.user),
    findByPhone: jest.fn().mockResolvedValue(options.user === undefined ? USER : options.user),
    createUser: jest.fn().mockResolvedValue({ ...USER, isPhoneVerified: false }),
    updateLastLogin: jest.fn().mockResolvedValue(undefined),
    toSafeUser: jest.fn().mockImplementation((user: unknown) => user),
  };
  const sms = {
    send: jest.fn().mockImplementation(() => (options.smsFails ? Promise.reject(new Error('gateway down')) : Promise.resolve())),
  };
  const jwt = { sign: jest.fn().mockReturnValue('token') };
  const config = { get: jest.fn().mockImplementation((key: string) => (key.includes('ExpiresIn') ? '15m' : 'secret')) };
  const devices = { findOrCreateForLogin: jest.fn().mockResolvedValue({ id: 'd1' }) };
  const sessions = { create: jest.fn().mockResolvedValue({}), revokeAllForUser: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  // Vrai service de réglages (lecture d'un faux prisma) : on teste aussi le branchement indicatifs → AuthService.
  const otpSettings = new OtpSettingsService({
    platformSetting: {
      findMany: jest.fn().mockResolvedValue([
        { key: 'otp.allowed_phone_prefixes', value: settings.allowedPhonePrefixes.join(',') || '*' },
        { key: 'otp.expiry_seconds', value: settings.expirySeconds },
        { key: 'otp.max_attempts', value: settings.maxAttempts },
        { key: 'otp.request_limit', value: settings.requestLimit },
        { key: 'otp.request_window_minutes', value: settings.requestWindowMinutes },
        { key: 'otp.daily_limit_per_phone', value: settings.dailyLimitPerPhone },
        { key: 'otp.daily_limit_global', value: settings.dailyLimitGlobal },
      ]),
    },
  } as never);
  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    users as never,
    devices as never,
    sessions as never,
    {} as never,
    audit as never,
    sms as never,
    {} as never,
    otpSettings,
  );
  return { service, prisma, users, sms, audit, sessions };
}

afterEach(() => {
  delete process.env.AUTH_TEST_MODE_ENABLED;
  delete process.env.AUTH_TEST_PHONE_NUMBERS;
});

describe('AuthService.requestOtp', () => {
  it('envoie le code par SMS et n\'en garde que le hash', async () => {
    const { service, prisma, sms } = build();
    await expect(service.requestOtp({ phone: PHONE } as never)).resolves.toEqual({ expiresInSeconds: 300 });
    const sentCode = /(\d{6})/.exec(sms.send.mock.calls[0][1])?.[1] as string;
    expect(sms.send.mock.calls[0][0]).toBe(PHONE);
    const stored = prisma.otpCode.create.mock.calls[0][0].data;
    expect(stored).toMatchObject({ userId: 'u1', purpose: OtpPurpose.LOGIN, status: OtpStatus.PENDING, maxAttempts: 3 });
    expect(stored.code).toBe(hashOtpCode(sentCode));
    expect(JSON.stringify(stored)).not.toContain(sentCode);
  });

  it('utilise la durée et le nombre d\'essais des réglages de l\'administration', async () => {
    const { service, prisma, sms } = build({ settings: { expirySeconds: 600, maxAttempts: 5 } });
    await expect(service.requestOtp({ phone: PHONE } as never)).resolves.toEqual({ expiresInSeconds: 600 });
    expect(prisma.otpCode.create.mock.calls[0][0].data.maxAttempts).toBe(5);
    expect(sms.send.mock.calls[0][1]).toContain('10 minutes');
  });

  describe('échec du SMS', () => {
    it('503 avec un message clair, jamais une erreur 500', async () => {
      const { service } = build({ smsFails: true });
      const error = await service.requestOtp({ phone: PHONE } as never).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as Error).message).toMatch(/SMS n'a pas pu être envoyé/);
    });

    it('le code créé est retiré : il ne compte pas dans les plafonds et ne bloque pas un code précédent', async () => {
      const { service, prisma } = build({ smsFails: true });
      await expect(service.requestOtp({ phone: PHONE } as never)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.otpCode.delete).toHaveBeenCalledWith({ where: { id: 'otp-new' } });
    });

    it('le message d\'erreur technique ne remonte pas à l\'utilisateur', async () => {
      const { service } = build({ smsFails: true });
      await expect(service.requestOtp({ phone: PHONE } as never)).rejects.not.toThrow(/gateway down/);
    });

    it('même si le retrait du code échoue, la réponse reste le 503 clair', async () => {
      const { service, prisma } = build({ smsFails: true });
      prisma.otpCode.delete.mockRejectedValue(new Error('db down'));
      await expect(service.requestOtp({ phone: PHONE } as never)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('indicatifs autorisés', () => {
    it('numéro hors liste : refus clair, aucun compte créé, aucun SMS', async () => {
      const { service, users, sms, prisma } = build({ user: null, settings: { allowedPhonePrefixes: ['+224'] } });
      await expect(service.requestOtp({ phone: '+14155550100' } as never)).rejects.toThrow(/commençant par \+224/);
      expect(users.createUser).not.toHaveBeenCalled();
      expect(sms.send).not.toHaveBeenCalled();
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    });

    it('numéro dans la liste : parcours normal', async () => {
      const { service, sms } = build({ settings: { allowedPhonePrefixes: ['+224', '+33'] } });
      await service.requestOtp({ phone: PHONE } as never);
      expect(sms.send).toHaveBeenCalled();
    });
  });

  describe('plafonds', () => {
    it('plafond global atteint : 503, aucun compte créé, aucun SMS', async () => {
      const { service, users, sms } = build({ user: null, counts: [2000] });
      await expect(service.requestOtp({ phone: PHONE } as never)).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(users.createUser).not.toHaveBeenCalled();
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('plafond par fenêtre atteint pour ce numéro : 429, aucun SMS', async () => {
      const { service, sms } = build({ counts: [0, 5, 5] });
      await expect(service.requestOtp({ phone: PHONE } as never)).rejects.toMatchObject({ status: 429 });
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('plafond quotidien par numéro atteint : 429, aucun SMS', async () => {
      const { service, sms } = build({ counts: [0, 0, 10] });
      await expect(service.requestOtp({ phone: PHONE } as never)).rejects.toMatchObject({ status: 429 });
      expect(sms.send).not.toHaveBeenCalled();
    });
  });

  describe('autres refus', () => {
    it('intent LOGIN avec un numéro inconnu : refusé sans créer de compte', async () => {
      const { service, users } = build({ user: null });
      await expect(service.requestOtp({ phone: PHONE, intent: 'LOGIN' } as never)).rejects.toBeInstanceOf(BadRequestException);
      expect(users.createUser).not.toHaveBeenCalled();
    });

    it('inscription avec un numéro inconnu : le compte est créé puis le code envoyé', async () => {
      const { service, users, sms } = build({ user: null });
      users.createUser.mockResolvedValue({ ...USER, accountType: AccountType.DRIVER, isPhoneVerified: false });
      await service.requestOtp({ phone: PHONE, signupAccountType: AccountType.DRIVER } as never);
      expect(users.createUser).toHaveBeenCalledWith({ phone: PHONE, accountType: AccountType.DRIVER });
      expect(sms.send).toHaveBeenCalled();
    });

    it('compte suspendu : refusé sans SMS', async () => {
      const { service, sms } = build({ user: { ...USER, isSuspended: true } });
      await expect(service.requestOtp({ phone: PHONE } as never)).rejects.toThrow(/suspendu/);
      expect(sms.send).not.toHaveBeenCalled();
    });

    it('rôle demandé différent du compte existant : refusé avant tout SMS', async () => {
      const { service, sms } = build();
      await expect(
        service.requestOtp({ phone: PHONE, signupAccountType: AccountType.DRIVER, intent: 'LOGIN' } as never),
      ).rejects.toThrow(/compte Client/);
      expect(sms.send).not.toHaveBeenCalled();
    });
  });

  describe('mode test', () => {
    it('numéro listé et mode actif : code 000000, aucun SMS, aucun plafond', async () => {
      process.env.AUTH_TEST_MODE_ENABLED = 'true';
      process.env.AUTH_TEST_PHONE_NUMBERS = PHONE;
      const { service, sms, prisma } = build({ counts: [99999, 99999, 99999], settings: { allowedPhonePrefixes: ['+33'] } });
      await expect(service.requestOtp({ phone: PHONE } as never)).resolves.toEqual({ expiresInSeconds: 300 });
      expect(sms.send).not.toHaveBeenCalled();
      expect(prisma.otpCode.create.mock.calls[0][0].data.code).toBe(hashOtpCode('000000'));
    });

    it('mode désactivé : un numéro listé suit le parcours normal', async () => {
      process.env.AUTH_TEST_PHONE_NUMBERS = PHONE;
      const { service, sms } = build();
      await service.requestOtp({ phone: PHONE } as never);
      expect(sms.send).toHaveBeenCalled();
    });
  });
});

describe('AuthService.verifyOtpAndLogin', () => {
  const otpRow = (code: string, extra: Record<string, unknown> = {}) => ({
    id: 'otp1',
    code: hashOtpCode(code),
    attempts: 0,
    maxAttempts: 3,
    expiresAt: FUTURE(),
    ...extra,
  });
  const dto = (code: string) => ({ phone: PHONE, code }) as never;
  const context = { ipAddress: '1.2.3.4', userAgent: 'jest' };

  it('bon code : connexion, code consommé, session créée, connexion journalisée', async () => {
    const { service, prisma, sessions, audit } = build({ otp: otpRow('123456') });
    const result = await service.verifyOtpAndLogin(dto('123456'), context);
    expect(result.accessToken).toBe('token');
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'otp1', status: OtpStatus.PENDING },
        data: expect.objectContaining({ status: OtpStatus.VERIFIED }),
      }),
    );
    expect(sessions.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_OTP', actorId: 'u1' }));
  });

  it('première connexion : le numéro est marqué vérifié', async () => {
    const { service, prisma } = build({ user: { ...USER, isPhoneVerified: false }, otp: otpRow('123456') });
    await service.verifyOtpAndLogin(dto('123456'), context);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { isPhoneVerified: true } });
  });

  it('mauvais code : 401, essai compté, aucune session', async () => {
    const { service, prisma, sessions } = build({ otp: otpRow('123456') });
    await expect(service.verifyOtpAndLogin(dto('000000'), context)).rejects.toThrow('Code invalide.');
    // L'essai est consommé atomiquement (seulement si le code est en attente et sous son maximum d'essais).
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'otp1', status: OtpStatus.PENDING, attempts: { lt: 3 } },
      data: { attempts: { increment: 1 } },
    });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('essais consommés en parallèle : refusé même avec le bon code, aucune session', async () => {
    const { service, sessions } = build({ otp: otpRow('123456', { attempts: 2 }), updateManyCounts: [0] });
    await expect(service.verifyOtpAndLogin(dto('123456'), context)).rejects.toThrow(/Trop de tentatives/);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('usage unique : deux requêtes avec le bon code en même temps → une seule session', async () => {
    const { service, sessions } = build({ otp: otpRow('123456'), updateManyCounts: [1, 0] });
    await expect(service.verifyOtpAndLogin(dto('123456'), context)).rejects.toThrow(/déjà été utilisé/);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('essais épuisés : code bloqué, même avec le bon code', async () => {
    const { service, prisma, sessions } = build({ otp: otpRow('123456', { attempts: 3 }) });
    await expect(service.verifyOtpAndLogin(dto('123456'), context)).rejects.toThrow(/Trop de tentatives/);
    expect(prisma.otpCode.update).toHaveBeenCalledWith({ where: { id: 'otp1' }, data: { status: OtpStatus.FAILED } });
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('code expiré ou absent : 401', async () => {
    await expect(build({ otp: null }).service.verifyOtpAndLogin(dto('123456'), context)).rejects.toBeInstanceOf(UnauthorizedException);
    const expired = build({ otp: otpRow('123456', { expiresAt: new Date(Date.now() - 1000) }) });
    await expect(expired.service.verifyOtpAndLogin(dto('123456'), context)).rejects.toThrow(/expiré/);
  });

  it('numéro inconnu : refusé', async () => {
    const { service } = build({ user: null });
    await expect(service.verifyOtpAndLogin(dto('123456'), context)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un code haché avec un autre secret (ancien format) n\'ouvre aucune session', async () => {
    process.env.OTP_HASH_PEPPER = 'ancien-secret';
    const old = otpRow('123456');
    process.env.OTP_HASH_PEPPER = 'nouveau-secret';
    const { service, sessions } = build({ otp: old });
    await expect(service.verifyOtpAndLogin(dto('123456'), context)).rejects.toThrow('Code invalide.');
    expect(sessions.create).not.toHaveBeenCalled();
    delete process.env.OTP_HASH_PEPPER;
  });
});

describe('AuthService.confirmPasswordReset', () => {
  const STAFF = { ...USER, accountType: AccountType.SUPPORT };
  const otpRow = (code: string, extra: Record<string, unknown> = {}) => ({
    id: 'otp1',
    code: hashOtpCode(code),
    attempts: 0,
    maxAttempts: 3,
    expiresAt: FUTURE(),
    ...extra,
  });
  const dto = (code: string) => ({ email: 'staff@occaz.test', code, newPassword: 'NouveauMotDePasse!1' }) as never;

  it('bon code : mot de passe changé, code consommé, sessions révoquées', async () => {
    const { service, prisma, sessions } = build({ user: STAFF, otp: otpRow('123456') });
    await expect(service.confirmPasswordReset(dto('123456'))).resolves.toMatchObject({ message: expect.stringContaining('Mot de passe mis à jour') });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: { passwordHash: expect.any(String) } }),
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('mauvais code : essai compté, mot de passe inchangé', async () => {
    const { service, prisma } = build({ user: STAFF, otp: otpRow('123456') });
    await expect(service.confirmPasswordReset(dto('000000'))).rejects.toThrow('Code invalide.');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('essais épuisés en parallèle, ou code déjà utilisé : refusé, mot de passe inchangé', async () => {
    const exhausted = build({ user: STAFF, otp: otpRow('123456'), updateManyCounts: [0] });
    await expect(exhausted.service.confirmPasswordReset(dto('123456'))).rejects.toThrow(/Trop de tentatives/);
    const replay = build({ user: STAFF, otp: otpRow('123456'), updateManyCounts: [1, 0] });
    await expect(replay.service.confirmPasswordReset(dto('123456'))).rejects.toThrow(/déjà été utilisé/);
    expect(exhausted.prisma.user.update).not.toHaveBeenCalled();
    expect(replay.prisma.user.update).not.toHaveBeenCalled();
  });
});
