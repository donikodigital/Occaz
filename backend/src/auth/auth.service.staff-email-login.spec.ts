// backend/src/auth/auth.service.staff-email-login.spec.ts
// Connexion de l'équipe du back-office (Support, Superviseur, Finance, SuperAdmin) : code envoyé par e-mail, jamais par SMS.
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AccountType, OtpPurpose, OtpStatus } from '@prisma/client';
import { hashOtpCode } from '../common/utils/otp.util';
import { OtpSettings, OtpSettingsService } from '../otp/otp-settings.service';
import { AuthService } from './auth.service';

const EMAIL = 'agent@occaz.sarl';
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
const STAFF = { id: 'staff1', phone: PHONE, email: EMAIL, accountType: AccountType.SUPPORT, isSuspended: false, isPhoneVerified: true };
const FUTURE = () => new Date(Date.now() + 5 * 60_000);

function build(options: { user?: Record<string, unknown> | null; counts?: number[]; emailFails?: boolean; otp?: Record<string, unknown> | null } = {}) {
  const counts = [...(options.counts ?? [])];
  const user = options.user === undefined ? STAFF : options.user;
  const prisma = {
    otpCode: {
      count: jest.fn().mockImplementation(() => Promise.resolve(counts.shift() ?? 0)),
      create: jest.fn().mockResolvedValue({ id: 'otp-new' }),
      delete: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue(options.otp ?? null),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
  };
  const users = {
    findByEmail: jest.fn().mockResolvedValue(user),
    findByPhone: jest.fn().mockResolvedValue(user),
    updateLastLogin: jest.fn().mockResolvedValue(undefined),
    toSafeUser: jest.fn().mockImplementation((u: unknown) => u),
  };
  const sms = { send: jest.fn().mockResolvedValue(undefined) };
  const email = {
    send: jest.fn().mockImplementation(() => (options.emailFails ? Promise.reject(new Error('resend down')) : Promise.resolve())),
  };
  const jwt = { sign: jest.fn().mockReturnValue('token') };
  const config = { get: jest.fn().mockImplementation((key: string) => (key.includes('ExpiresIn') ? '15m' : 'secret')) };
  const devices = { findOrCreateForLogin: jest.fn().mockResolvedValue({ id: 'd1' }) };
  const sessions = { create: jest.fn().mockResolvedValue({}) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const otpSettings = new OtpSettingsService({ platformSetting: { findMany: jest.fn().mockResolvedValue([]) } } as never);
  jest.spyOn(otpSettings, 'get').mockResolvedValue(SETTINGS);
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
    email as never,
    otpSettings,
  );
  return { service, prisma, users, sms, email, audit, sessions };
}

afterEach(() => {
  delete process.env.AUTH_TEST_MODE_ENABLED;
  delete process.env.AUTH_TEST_STAFF_EMAILS;
  delete process.env.AUTH_TEST_PHONE_NUMBERS;
});

describe('AuthService.requestStaffEmailCode', () => {
  it('envoie le code à l’adresse du compte, jamais par SMS, et n’en garde que le hash', async () => {
    const { service, prisma, email, sms } = build();
    await expect(service.requestStaffEmailCode({ email: 'Agent@Occaz.sarl ' })).resolves.toEqual({
      expiresInSeconds: 300,
      destination: 'a•••t@occaz.sarl',
    });
    expect(sms.send).not.toHaveBeenCalled();
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0][0]).toBe(EMAIL);
    const sentCode = /(\d{6})/.exec(email.send.mock.calls[0][2])?.[1] as string;
    const stored = prisma.otpCode.create.mock.calls[0][0].data;
    expect(stored).toMatchObject({ userId: 'staff1', purpose: OtpPurpose.LOGIN, status: OtpStatus.PENDING, maxAttempts: 3 });
    expect(stored.code).toBe(hashOtpCode(sentCode));
    expect(JSON.stringify(stored)).not.toContain(sentCode);
  });

  it('ne révèle rien : adresse inconnue, compte client ou compte suspendu reçoivent la même réponse, sans e-mail', async () => {
    for (const user of [null, { ...STAFF, accountType: AccountType.CUSTOMER }, { ...STAFF, isSuspended: true }]) {
      const { service, email, prisma } = build({ user });
      await expect(service.requestStaffEmailCode({ email: EMAIL })).resolves.toMatchObject({ expiresInSeconds: 300 });
      expect(email.send).not.toHaveBeenCalled();
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    }
  });

  it('tous les rôles de l’équipe sont admis (SuperAdmin compris)', async () => {
    const { service, email } = build({ user: { ...STAFF, accountType: AccountType.SUPERADMIN } });
    await service.requestStaffEmailCode({ email: EMAIL });
    expect(email.send).toHaveBeenCalled();
  });

  it('plafond par fenêtre atteint : 429, aucun e-mail', async () => {
    const { service, email } = build({ counts: [5, 5] });
    await expect(service.requestStaffEmailCode({ email: EMAIL })).rejects.toMatchObject({ status: 429 });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('échec de l’e-mail : 503 clair, code retiré, détail technique non exposé', async () => {
    const { service, prisma } = build({ emailFails: true });
    const error = await service.requestStaffEmailCode({ email: EMAIL }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as Error).message).toMatch(/e-mail n'a pas pu être envoyé/);
    expect((error as Error).message).not.toMatch(/resend down/);
    expect(prisma.otpCode.delete).toHaveBeenCalledWith({ where: { id: 'otp-new' } });
  });

  it('mode test : adresse listée → code 000000, aucun e-mail ; mode désactivé → parcours normal', async () => {
    process.env.AUTH_TEST_STAFF_EMAILS = EMAIL;
    const off = build();
    await off.service.requestStaffEmailCode({ email: EMAIL });
    expect(off.email.send).toHaveBeenCalled();

    process.env.AUTH_TEST_MODE_ENABLED = 'true';
    const on = build();
    await on.service.requestStaffEmailCode({ email: EMAIL });
    expect(on.email.send).not.toHaveBeenCalled();
    expect(on.prisma.otpCode.create.mock.calls[0][0].data.code).toBe(hashOtpCode('000000'));
  });
});

describe('AuthService.verifyStaffEmailCodeAndLogin', () => {
  const otp = (code: string, extra: Record<string, unknown> = {}) => ({
    id: 'otp1',
    code: hashOtpCode(code),
    attempts: 0,
    maxAttempts: 3,
    expiresAt: FUTURE(),
    ...extra,
  });

  it('bon code : session ouverte, connexion journalisée', async () => {
    const { service, audit, sessions, users } = build({ otp: otp('123456') });
    await expect(service.verifyStaffEmailCodeAndLogin({ email: EMAIL, code: '123456' }, { ipAddress: '1.2.3.4' })).resolves.toMatchObject({
      accessToken: 'token',
      refreshToken: 'token',
    });
    expect(sessions.create).toHaveBeenCalled();
    expect(users.updateLastLogin).toHaveBeenCalledWith('staff1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'LOGIN_EMAIL_OTP', actorId: 'staff1' }));
  });

  it('mauvais code : 401, aucune session', async () => {
    const { service, sessions } = build({ otp: otp('123456') });
    await expect(service.verifyStaffEmailCodeAndLogin({ email: EMAIL, code: '999999' }, {})).rejects.toThrow(/Code invalide/);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('adresse inconnue ou compte client : même message que « aucun code », aucune session', async () => {
    for (const user of [null, { ...STAFF, accountType: AccountType.DRIVER }]) {
      const { service, sessions } = build({ user });
      await expect(service.verifyStaffEmailCodeAndLogin({ email: EMAIL, code: '123456' }, {})).rejects.toThrow(
        /Code expiré ou introuvable/,
      );
      expect(sessions.create).not.toHaveBeenCalled();
    }
  });

  it('code expiré ou absent : 401', async () => {
    const { service } = build({ otp: null });
    await expect(service.verifyStaffEmailCodeAndLogin({ email: EMAIL, code: '123456' }, {})).rejects.toBeInstanceOf(UnauthorizedException);
    const expired = build({ otp: otp('123456', { expiresAt: new Date(Date.now() - 1000) }) });
    await expect(expired.service.verifyStaffEmailCodeAndLogin({ email: EMAIL, code: '123456' }, {})).rejects.toThrow(/expiré/);
  });

  it('essais épuisés : code bloqué même avec le bon code', async () => {
    const { service, prisma } = build({ otp: otp('123456', { attempts: 3 }) });
    await expect(service.verifyStaffEmailCodeAndLogin({ email: EMAIL, code: '123456' }, {})).rejects.toThrow(/Trop de tentatives/);
    expect(prisma.otpCode.update).toHaveBeenCalledWith({ where: { id: 'otp1' }, data: { status: OtpStatus.FAILED } });
  });

  it('compte suspendu entre-temps : refusé même avec le bon code', async () => {
    const { service, sessions } = build({ user: { ...STAFF, isSuspended: true }, otp: otp('123456') });
    await expect(service.verifyStaffEmailCodeAndLogin({ email: EMAIL, code: '123456' }, {})).rejects.toThrow(/suspendu/);
    expect(sessions.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.requestOtp (ancien parcours téléphone) et l’équipe', () => {
  it('un compte de l’équipe ne reçoit jamais de SMS : refus clair, aucun code créé', async () => {
    const { service, sms, prisma } = build();
    await expect(service.requestOtp({ phone: PHONE } as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.requestOtp({ phone: PHONE } as never)).rejects.toThrow(/par e-mail/);
    expect(sms.send).not.toHaveBeenCalled();
    expect(prisma.otpCode.create).not.toHaveBeenCalled();
  });

  it('un numéro de test de l’équipe garde son code fixe (aucun SMS)', async () => {
    process.env.AUTH_TEST_MODE_ENABLED = 'true';
    process.env.AUTH_TEST_PHONE_NUMBERS = PHONE;
    const { service, sms, prisma } = build();
    await expect(service.requestOtp({ phone: PHONE } as never)).resolves.toEqual({ expiresInSeconds: 300 });
    expect(sms.send).not.toHaveBeenCalled();
    expect(prisma.otpCode.create.mock.calls[0][0].data.code).toBe(hashOtpCode('000000'));
  });
});
