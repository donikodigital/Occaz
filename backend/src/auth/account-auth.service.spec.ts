// backend/src/auth/account-auth.service.spec.ts
// Inscription en étapes, connexion par numéro + mot de passe (verrouillage, numéros de test), mot de passe oublié.
// bcrypt est simulé : son module natif n'a rien à prouver ici, et ce test doit tourner partout.
jest.mock('bcrypt', () => ({
  hash: jest.fn(async (plain: string) => `hashed:${plain}`),
  compare: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
}));

import { JwtService } from '@nestjs/jwt';
import { AccountType } from '@prisma/client';
import { generateOtpCode } from '../common/utils/otp.util';
import { pinDigest } from '../common/utils/pin.util';
import { AccountAuthService, LOGIN_LOCK_MINUTES, MAX_LOGIN_FAILURES } from './account-auth.service';

const PHONE = '+224620000010';
const TEST_PHONE = '+224600000001';
const SETTINGS = {
  expirySeconds: 300,
  maxAttempts: 3,
  requestLimit: 5,
  requestWindowMinutes: 15,
  dailyLimitPerPhone: 10,
  dailyLimitGlobal: 2000,
  handoverSmsDailyLimit: 5,
  allowedPhonePrefixes: [] as string[],
  phoneChangeCooldownDays: 30,
  notificationSmsDailyLimitPerUser: 10,
};

type Row = Record<string, any>;

/** Une mini-base en mémoire : assez fidèle pour suivre un parcours complet (codes, essais, comptes) sans base réelle. */
function build() {
  const users: Row[] = [];
  const otps: Row[] = [];
  let seq = 0;

  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, cond]) => {
      const value = row[key];
      if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('in' in cond) return cond.in.includes(value);
        if ('not' in cond) return value !== cond.not;
        if ('gte' in cond) return value >= cond.gte;
        if ('lt' in cond) return value < cond.lt;
      }
      return value === cond;
    });
  const applyData = (row: Row, data: Row) => {
    for (const [key, value] of Object.entries(data)) {
      row[key] = value && typeof value === 'object' && 'increment' in value ? (row[key] ?? 0) + value.increment : value;
    }
  };

  const prisma = {
    user: {
      update: jest.fn(async ({ where, data }: Row) => {
        const row = users.find((u) => u.id === where.id)!;
        applyData(row, data);
        return { ...row };
      }),
    },
    otpCode: {
      create: jest.fn(async ({ data }: Row) => {
        const row = { id: `otp${++seq}`, attempts: 0, verifiedAt: null, target: null, createdAt: new Date(Date.now() + seq), ...data };
        otps.push(row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: Row) => otps.filter((o) => matches(o, where)).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null),
      updateMany: jest.fn(async ({ where, data }: Row) => {
        const found = otps.filter((o) => matches(o, where));
        found.forEach((o) => applyData(o, data));
        return { count: found.length };
      }),
      update: jest.fn(async ({ where, data }: Row) => {
        const row = otps.find((o) => o.id === where.id)!;
        applyData(row, data);
        return row;
      }),
      count: jest.fn(async ({ where }: Row) => otps.filter((o) => matches(o, where)).length),
      delete: jest.fn(async ({ where }: Row) => {
        const index = otps.findIndex((o) => o.id === where.id);
        if (index >= 0) otps.splice(index, 1);
      }),
    },
  };

  const usersService = {
    findByPhone: jest.fn(async (phone: string) => users.find((u) => u.phone === phone) ?? null),
    findByEmail: jest.fn(async (email: string) => users.find((u) => u.email === email) ?? null),
    findById: jest.fn(async (id: string) => users.find((u) => u.id === id) ?? null),
    createUser: jest.fn(async (data: Row) => {
      const row = {
        id: `u${++seq}`,
        email: null,
        passwordHash: null,
        isPhoneVerified: false,
        isEmailVerified: false,
        isSuspended: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...data,
      };
      users.push(row);
      return { ...row };
    }),
    updateLastLogin: jest.fn(async () => undefined),
    getSafeById: jest.fn(async (id: string) => ({ ...users.find((u) => u.id === id)! })),
  };

  const sms = { send: jest.fn(async () => undefined) };
  const email = { send: jest.fn(async () => undefined) };
  const sessions = { revokeAllForUser: jest.fn(async () => undefined), revokeOthersForUser: jest.fn(async () => undefined) };
  const audit = { log: jest.fn(async () => undefined) };
  const devices = { findOrCreateForLogin: jest.fn(async () => null) };
  const authService = { issueTokens: jest.fn(async (user: Row) => ({ accessToken: 'access', refreshToken: 'refresh', expiresIn: 900, user })) };
  const otpSettings = { get: jest.fn(async () => SETTINGS), assertPhoneAllowed: jest.fn() };
  const config = { get: jest.fn(() => 'jwt-secret') };

  const service = new AccountAuthService(
    prisma as never,
    new JwtService({}),
    config as never,
    usersService as never,
    devices as never,
    sessions as never,
    authService as never,
    audit as never,
    sms as never,
    email as never,
    otpSettings as never,
  );

  /** Compte déjà inscrit, avec son mot de passe. */
  const addUser = (extra: Row = {}) => {
    const row = {
      id: `u${++seq}`,
      phone: PHONE,
      accountType: AccountType.CUSTOMER,
      email: null,
      passwordHash: `hashed:${pinDigest('482913')}`,
      isPhoneVerified: true,
      isEmailVerified: false,
      isSuspended: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      ...extra,
    };
    users.push(row);
    return row;
  };
  /** Le dernier code envoyé par SMS ou e-mail, lu dans le texte du message (jamais dans la base : seul son hash y est). */
  const lastCode = (channel: { send: jest.Mock }): string => {
    const calls = channel.send.mock.calls as unknown as string[][];
    const [, ...message] = calls[calls.length - 1]!;
    return /(\d{6})/.exec(message.join(' '))![1]!;
  };
  return { service, users, otps, prisma, usersService, sms, email, sessions, audit, authService, addUser, lastCode, otpSettings };
}

const env = { ...process.env };
beforeEach(() => {
  process.env.OTP_HASH_PEPPER = 'test-pepper';
  delete process.env.AUTH_TEST_MODE_ENABLED;
  delete process.env.AUTH_TEST_PHONE_NUMBERS;
  delete process.env.AUTH_LEGACY_OTP_LOGIN;
});
afterAll(() => {
  process.env = { ...env };
});

describe('Inscription — le téléphone', () => {
  it('crée le compte et envoie tout de suite le code par SMS', async () => {
    const { service, users, sms } = build();
    const result = await service.requestSignupCode({ phone: PHONE, accountType: 'DRIVER' });
    expect(result.expiresInSeconds).toBe(300);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ phone: PHONE, accountType: 'DRIVER', isPhoneVerified: false });
    expect(sms.send).toHaveBeenCalledTimes(1);
    const [to, text] = sms.send.mock.calls[0] as unknown as [string, string];
    expect(to).toBe(PHONE);
    expect(text).toMatch(/^Occa'Z : \d{6} est votre code de vérification/);
  });

  it('refuse un numéro qui a déjà un mot de passe', async () => {
    const { service, addUser, sms } = build();
    addUser();
    await expect(service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' })).rejects.toThrow(/déjà un compte/);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('refuse un numéro déjà inscrit dans l’autre rôle, en le disant clairement', async () => {
    const { service, addUser } = build();
    addUser({ accountType: AccountType.DRIVER });
    await expect(service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' })).rejects.toThrow(/compte Conducteur/);
  });

  it('refuse un numéro de l’équipe', async () => {
    const { service, addUser } = build();
    addUser({ accountType: AccountType.SUPPORT, passwordHash: null });
    await expect(service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' })).rejects.toThrow(/ne peut pas être utilisé/);
  });

  it('une inscription inachevée reprend : nouveau code, l’ancien ne marche plus', async () => {
    const { service, users, sms, lastCode } = build();
    await service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' });
    const first = lastCode(sms);
    await service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' });
    expect(users).toHaveLength(1);
    const second = lastCode(sms);
    if (first !== second) {
      await expect(service.verifySignupCode({ phone: PHONE, code: first }, {})).rejects.toThrow(/Code invalide/);
    }
  });

  it('SMS impossible à envoyer : réponse claire et code retiré (il ne compte pas dans les plafonds)', async () => {
    const { service, sms, otps } = build();
    sms.send.mockRejectedValueOnce(new Error('passerelle HS'));
    await expect(service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' })).rejects.toMatchObject({ status: 503 });
    expect(otps).toHaveLength(0);
  });

  it('numéro hors des indicatifs autorisés : refusé avant tout envoi', async () => {
    const { service, sms, otpSettings } = build();
    otpSettings.assertPhoneAllowed.mockImplementation(() => {
      throw new Error('indicatif refusé');
    });
    await expect(service.requestSignupCode({ phone: '+15550000', accountType: 'CUSTOMER' })).rejects.toThrow(/indicatif refusé/);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('au plus 5 codes par fenêtre pour un même numéro', async () => {
    const { service } = build();
    for (let i = 0; i < 5; i++) await service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' });
    await expect(service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' })).rejects.toMatchObject({ status: 429 });
  });
});

describe('Inscription — vérification du numéro', () => {
  it('le bon code connecte le compte et marque le numéro comme vérifié', async () => {
    const { service, users, sms, lastCode, authService } = build();
    await service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' });
    const result = await service.verifySignupCode({ phone: PHONE, code: lastCode(sms) }, { ipAddress: '1.2.3.4' });
    expect(result.accessToken).toBe('access');
    expect(users[0]!.isPhoneVerified).toBe(true);
    expect(authService.issueTokens).toHaveBeenCalledTimes(1);
  });

  it('un mauvais code est refusé, et trois erreurs bloquent le code', async () => {
    const { service, sms, lastCode } = build();
    await service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' });
    const real = lastCode(sms);
    const wrong = real === '111111' ? '222222' : '111111';
    for (let i = 0; i < 3; i++) await expect(service.verifySignupCode({ phone: PHONE, code: wrong }, {})).rejects.toThrow(/Code invalide/);
    await expect(service.verifySignupCode({ phone: PHONE, code: real }, {})).rejects.toThrow(/Trop de tentatives/);
  });

  it('un code ne sert qu’une fois', async () => {
    const { service, sms, lastCode, users } = build();
    await service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' });
    const code = lastCode(sms);
    await service.verifySignupCode({ phone: PHONE, code }, {});
    // Le compte n'a pas encore de mot de passe : un second essai avec le même code doit échouer.
    await expect(service.verifySignupCode({ phone: PHONE, code }, {})).rejects.toThrow(/expiré ou introuvable/);
    expect(users).toHaveLength(1);
  });

  it('un code expiré est refusé', async () => {
    const { service, sms, lastCode, otps } = build();
    await service.requestSignupCode({ phone: PHONE, accountType: 'CUSTOMER' });
    otps[0]!.expiresAt = new Date(Date.now() - 1000);
    await expect(service.verifySignupCode({ phone: PHONE, code: lastCode(sms) }, {})).rejects.toThrow(/expiré/);
  });
});

describe('Inscription — l’e-mail (facultatif)', () => {
  it('envoie un code à l’adresse, puis l’enregistre comme vérifiée', async () => {
    const { service, addUser, email, lastCode, users } = build();
    const user = addUser({ passwordHash: null });
    await service.requestEmailCode(user.id, '  Fatoumata@Exemple.com ');
    const [to] = email.send.mock.calls[0] as unknown as [string];
    expect(to).toBe('fatoumata@exemple.com');
    const safe = await service.verifyEmailCode(user.id, 'fatoumata@exemple.com', lastCode(email));
    expect(users[0]).toMatchObject({ email: 'fatoumata@exemple.com', isEmailVerified: true });
    expect(safe.email).toBe('fatoumata@exemple.com');
  });

  it('refuse une adresse déjà prise par un autre compte', async () => {
    const { service, addUser, email } = build();
    addUser({ phone: '+224620000011', email: 'pris@exemple.com' });
    const me = addUser({ passwordHash: null });
    await expect(service.requestEmailCode(me.id, 'pris@exemple.com')).rejects.toMatchObject({ status: 409 });
    expect(email.send).not.toHaveBeenCalled();
  });

  it('le code est lié à l’adresse : changer d’adresse en route invalide le code', async () => {
    const { service, addUser, email, lastCode } = build();
    const me = addUser({ passwordHash: null });
    await service.requestEmailCode(me.id, 'a@exemple.com');
    await expect(service.verifyEmailCode(me.id, 'b@exemple.com', lastCode(email))).rejects.toThrow(/expiré ou introuvable/);
  });

  it('e-mail non envoyé : réponse claire, code retiré', async () => {
    const { service, addUser, email, otps } = build();
    const me = addUser({ passwordHash: null });
    email.send.mockRejectedValueOnce(new Error('Resend HS'));
    await expect(service.requestEmailCode(me.id, 'a@exemple.com')).rejects.toMatchObject({ status: 503 });
    expect(otps).toHaveLength(0);
  });

  it('adresse déjà vérifiée sur ce compte : rien à refaire', async () => {
    const { service, addUser } = build();
    const me = addUser({ email: 'ok@exemple.com', isEmailVerified: true });
    await expect(service.requestEmailCode(me.id, 'ok@exemple.com')).rejects.toThrow(/déjà vérifiée/);
  });
});

describe('Inscription — le mot de passe à 6 chiffres', () => {
  it('définit le mot de passe une première fois', async () => {
    const { service, addUser, users } = build();
    const me = addUser({ passwordHash: null });
    await service.setPassword(me.id, '482913');
    expect(users[0]!.passwordHash).toBe(`hashed:${pinDigest('482913')}`);
  });

  it('refuse un code trop facile, ou qui n’a pas 6 chiffres', async () => {
    const { service, addUser, users } = build();
    const me = addUser({ passwordHash: null });
    await expect(service.setPassword(me.id, '123456')).rejects.toThrow(/trop facile/);
    await expect(service.setPassword(me.id, '1234')).rejects.toThrow(/6 chiffres/);
    expect(users[0]!.passwordHash).toBeNull();
  });

  it('ne remplace jamais un mot de passe existant (pour le changer : « Mot de passe oublié »)', async () => {
    const { service, addUser } = build();
    const me = addUser();
    await expect(service.setPassword(me.id, '705318')).rejects.toThrow(/Mot de passe oublié/);
  });
});

describe('Connexion — numéro + mot de passe', () => {
  it('le bon mot de passe ouvre la session, sans aucun SMS', async () => {
    const { service, addUser, sms, authService } = build();
    addUser();
    const result = await service.loginWithPhone({ phone: PHONE, password: '482913' }, { ipAddress: '1.2.3.4' });
    expect(result.accessToken).toBe('access');
    expect(sms.send).not.toHaveBeenCalled();
    expect(authService.issueTokens).toHaveBeenCalledTimes(1);
  });

  it('mauvais mot de passe et numéro inconnu : exactement le même message', async () => {
    const { service, addUser } = build();
    addUser();
    const wrong = await service.loginWithPhone({ phone: PHONE, password: '000111' }, {}).catch((error) => error);
    const unknown = await service.loginWithPhone({ phone: '+224620000099', password: '482913' }, {}).catch((error) => error);
    expect(wrong.message).toBe('Numéro ou mot de passe incorrect.');
    expect(unknown.message).toBe(wrong.message);
    expect(unknown.getStatus()).toBe(wrong.getStatus());
  });

  it(`après ${MAX_LOGIN_FAILURES} erreurs de suite le compte est verrouillé ${LOGIN_LOCK_MINUTES} minutes, même avec le bon mot de passe`, async () => {
    const { service, addUser, users } = build();
    addUser();
    for (let i = 0; i < MAX_LOGIN_FAILURES - 1; i++) {
      await expect(service.loginWithPhone({ phone: PHONE, password: '000111' }, {})).rejects.toMatchObject({ status: 401 });
    }
    await expect(service.loginWithPhone({ phone: PHONE, password: '000111' }, {})).rejects.toMatchObject({ status: 429 });
    expect(users[0]!.lockedUntil).toBeInstanceOf(Date);
    await expect(service.loginWithPhone({ phone: PHONE, password: '482913' }, {})).rejects.toThrow(/Trop d'essais/);
  });

  it('une fois le verrouillage passé, le bon mot de passe fonctionne et le compteur repart de zéro', async () => {
    const { service, addUser, users } = build();
    addUser({ failedLoginAttempts: 3, lockedUntil: new Date(Date.now() - 1000) });
    await service.loginWithPhone({ phone: PHONE, password: '482913' }, {});
    expect(users[0]).toMatchObject({ failedLoginAttempts: 0, lockedUntil: null });
  });

  it('un compte sans mot de passe est orienté vers « Mot de passe oublié »', async () => {
    const { service, addUser } = build();
    addUser({ passwordHash: null });
    await expect(service.loginWithPhone({ phone: PHONE, password: '482913' }, {})).rejects.toThrow(/Mot de passe oublié/);
  });

  it('un compte suspendu est refusé (après vérification du mot de passe)', async () => {
    const { service, addUser } = build();
    addUser({ isSuspended: true });
    await expect(service.loginWithPhone({ phone: PHONE, password: '482913' }, {})).rejects.toThrow(/suspendu/);
  });

  it('le mauvais espace est expliqué une fois le mot de passe correct', async () => {
    const { service, addUser } = build();
    addUser({ accountType: AccountType.DRIVER });
    await expect(service.loginWithPhone({ phone: PHONE, password: '482913', expectedAccountType: 'CUSTOMER' }, {})).rejects.toThrow(
      /Je suis conducteur/,
    );
  });

  it('les comptes de l’équipe ne se connectent pas par ici', async () => {
    const { service, addUser } = build();
    addUser({ accountType: AccountType.SUPPORT });
    await expect(service.loginWithPhone({ phone: PHONE, password: '482913' }, {})).rejects.toThrow(/incorrect/);
  });
});

describe('Numéros de test', () => {
  beforeEach(() => {
    process.env.AUTH_TEST_MODE_ENABLED = 'true';
    process.env.AUTH_TEST_PHONE_NUMBERS = TEST_PHONE;
  });

  it('se connectent avec 000000, sans mot de passe défini', async () => {
    const { service, addUser } = build();
    addUser({ phone: TEST_PHONE, passwordHash: null });
    await expect(service.loginWithPhone({ phone: TEST_PHONE, password: '000000' }, {})).resolves.toMatchObject({ accessToken: 'access' });
  });

  it('un numéro ordinaire n’a pas ce passe-droit', async () => {
    const { service, addUser } = build();
    addUser({ passwordHash: null });
    await expect(service.loginWithPhone({ phone: PHONE, password: '000000' }, {})).rejects.toThrow(/Mot de passe oublié/);
  });

  it('l’inscription n’envoie aucun SMS : tous les codes valent 000000', async () => {
    const { service, sms } = build();
    await service.requestSignupCode({ phone: TEST_PHONE, accountType: 'CUSTOMER' });
    expect(sms.send).not.toHaveBeenCalled();
    await expect(service.verifySignupCode({ phone: TEST_PHONE, code: '000000' }, {})).resolves.toMatchObject({ accessToken: 'access' });
  });

  it('l’e-mail et la réinitialisation aussi : aucun envoi, code 000000', async () => {
    const { service, addUser, email, sms } = build();
    const me = addUser({ phone: TEST_PHONE, passwordHash: null, email: 'test@exemple.com', isEmailVerified: true });
    await service.requestEmailCode(me.id, 'nouveau@exemple.com');
    await expect(service.verifyEmailCode(me.id, 'nouveau@exemple.com', '000000')).resolves.toBeDefined();
    await service.requestPasswordResetCode({ phone: TEST_PHONE, channel: 'SMS' });
    await service.requestPasswordResetCode({ phone: TEST_PHONE, channel: 'EMAIL' });
    expect(email.send).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('l’ancien code SMS de connexion reste ouvert pour eux', async () => {
    const { service } = build();
    await expect(service.assertLegacyOtpAllowed(TEST_PHONE)).resolves.toBeUndefined();
  });
});

describe('Mot de passe oublié', () => {
  it('par SMS : code, puis nouveau mot de passe ; l’ancien ne marche plus et les sessions sont coupées', async () => {
    const { service, addUser, sms, lastCode, sessions } = build();
    addUser();
    await service.requestPasswordResetCode({ phone: PHONE, channel: 'SMS' });
    const { resetToken } = await service.verifyPasswordResetCode({ phone: PHONE, code: lastCode(sms) });
    await service.resetPassword({ resetToken, newPassword: '705318' }, {});
    expect(sessions.revokeAllForUser).toHaveBeenCalledTimes(1);
    await expect(service.loginWithPhone({ phone: PHONE, password: '482913' }, {})).rejects.toThrow(/incorrect/);
    await expect(service.loginWithPhone({ phone: PHONE, password: '705318' }, {})).resolves.toMatchObject({ accessToken: 'access' });
  });

  it('le jeton ne sert qu’une fois', async () => {
    const { service, addUser, sms, lastCode } = build();
    addUser();
    await service.requestPasswordResetCode({ phone: PHONE, channel: 'SMS' });
    const { resetToken } = await service.verifyPasswordResetCode({ phone: PHONE, code: lastCode(sms) });
    await service.resetPassword({ resetToken, newPassword: '705318' }, {});
    await expect(service.resetPassword({ resetToken, newPassword: '190274' }, {})).rejects.toThrow(/expiré/);
  });

  it('un jeton falsifié ou un jeton d’accès est refusé', async () => {
    const { service, addUser } = build();
    const user = addUser();
    await expect(service.resetPassword({ resetToken: 'n.importe.quoi', newPassword: '705318' }, {})).rejects.toThrow(/expiré/);
    const accessLike = new JwtService({}).sign({ sub: user.id }, { secret: 'jwt-secret' });
    await expect(service.resetPassword({ resetToken: accessLike, newPassword: '705318' }, {})).rejects.toThrow(/expiré/);
  });

  it('le nouveau mot de passe est contrôlé comme à l’inscription', async () => {
    const { service, addUser, sms, lastCode } = build();
    addUser();
    await service.requestPasswordResetCode({ phone: PHONE, channel: 'SMS' });
    const { resetToken } = await service.verifyPasswordResetCode({ phone: PHONE, code: lastCode(sms) });
    await expect(service.resetPassword({ resetToken, newPassword: '111111' }, {})).rejects.toThrow(/trop facile/);
  });

  it('réinitialiser débloque un compte verrouillé', async () => {
    const { service, addUser, sms, lastCode, users } = build();
    addUser({ lockedUntil: new Date(Date.now() + 600_000), failedLoginAttempts: 0 });
    await service.requestPasswordResetCode({ phone: PHONE, channel: 'SMS' });
    const { resetToken } = await service.verifyPasswordResetCode({ phone: PHONE, code: lastCode(sms) });
    await service.resetPassword({ resetToken, newPassword: '705318' }, {});
    expect(users[0]!.lockedUntil).toBeNull();
  });

  it('par e-mail : le code part à l’adresse vérifiée, qui est masquée dans la réponse', async () => {
    const { service, addUser, email, sms } = build();
    addUser({ email: 'fatoumata@exemple.com', isEmailVerified: true });
    const result = await service.requestPasswordResetCode({ phone: PHONE, channel: 'EMAIL' });
    expect(result.destination).toBe('f•••a@exemple.com');
    expect(email.send).toHaveBeenCalledTimes(1);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('par e-mail sans adresse vérifiée : on explique de choisir le SMS', async () => {
    const { service, addUser, email } = build();
    addUser({ email: 'non.verifie@exemple.com', isEmailVerified: false });
    await expect(service.requestPasswordResetCode({ phone: PHONE, channel: 'EMAIL' })).rejects.toThrow(/Choisissez l'envoi par SMS/);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('numéro inconnu : même forme de réponse, aucun SMS (pas de crédit dépensé, pas de sondage)', async () => {
    const { service, sms } = build();
    const result = await service.requestPasswordResetCode({ phone: '+224620000099', channel: 'SMS' });
    expect(result.expiresInSeconds).toBe(300);
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('le dernier code demandé est le seul valable', async () => {
    const { service, addUser, sms, email, lastCode } = build();
    addUser({ email: 'fatoumata@exemple.com', isEmailVerified: true });
    await service.requestPasswordResetCode({ phone: PHONE, channel: 'SMS' });
    const smsCode = lastCode(sms);
    await service.requestPasswordResetCode({ phone: PHONE, channel: 'EMAIL' });
    const emailCode = lastCode(email);
    if (smsCode !== emailCode) {
      await expect(service.verifyPasswordResetCode({ phone: PHONE, code: smsCode })).rejects.toThrow(/Code invalide/);
    }
    await expect(service.verifyPasswordResetCode({ phone: PHONE, code: emailCode })).resolves.toHaveProperty('resetToken');
  });
});

describe('Ancienne connexion par SMS', () => {
  it('fermée pour un client ou un conducteur, et pour un numéro inconnu', async () => {
    const { service, addUser } = build();
    addUser();
    await expect(service.assertLegacyOtpAllowed(PHONE)).rejects.toThrow(/n’est plus utilisée/);
    await expect(service.assertLegacyOtpAllowed('+224620000099')).rejects.toThrow(/n’est plus utilisée/);
  });

  it('ouverte pour l’équipe du back-office', async () => {
    const { service, addUser } = build();
    addUser({ accountType: AccountType.SUPPORT });
    await expect(service.assertLegacyOtpAllowed(PHONE)).resolves.toBeUndefined();
  });

  it('rouvrable en urgence pour tous par AUTH_LEGACY_OTP_LOGIN', async () => {
    const { service, addUser } = build();
    addUser();
    process.env.AUTH_LEGACY_OTP_LOGIN = 'true';
    await expect(service.assertLegacyOtpAllowed(PHONE)).resolves.toBeUndefined();
  });
});

it('generateOtpCode produit toujours 6 chiffres (garde du format lu par les tests ci-dessus)', () => {
  for (let i = 0; i < 50; i++) expect(generateOtpCode()).toMatch(/^\d{6}$/);
});

describe('Changer son mot de passe (connecté)', () => {
  it('avec le bon mot de passe actuel : nouveau mot de passe, autres appareils déconnectés, cet appareil conservé', async () => {
    const { service, addUser, users, sessions, audit } = build();
    const me = addUser();
    await service.changePassword(me.id, { currentPassword: '482913', newPassword: '705318' }, { sessionId: 's1' });
    expect(users[0]!.passwordHash).toBe(`hashed:${pinDigest('705318')}`);
    expect(sessions.revokeOthersForUser).toHaveBeenCalledWith(me.id, 's1');
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PASSWORD_CHANGED' }));
  });

  it('mauvais mot de passe actuel : refusé, erreur comptée, mot de passe inchangé', async () => {
    const { service, addUser, users } = build();
    const me = addUser();
    await expect(
      service.changePassword(me.id, { currentPassword: '999000', newPassword: '705318' }, { sessionId: 's1' }),
    ).rejects.toThrow(/actuel incorrect/);
    expect(users[0]!.failedLoginAttempts).toBe(1);
    expect(users[0]!.passwordHash).toBe(`hashed:${pinDigest('482913')}`);
  });

  it('les erreurs verrouillent le compte comme à la connexion', async () => {
    const { service, addUser } = build();
    const me = addUser();
    for (let i = 0; i < MAX_LOGIN_FAILURES - 1; i += 1) {
      await expect(
        service.changePassword(me.id, { currentPassword: '999000', newPassword: '705318' }, { sessionId: 's1' }),
      ).rejects.toThrow(/actuel incorrect/);
    }
    await expect(
      service.changePassword(me.id, { currentPassword: '999000', newPassword: '705318' }, { sessionId: 's1' }),
    ).rejects.toMatchObject({ status: 429 });
    // Même avec le bon mot de passe, le compte reste verrouillé.
    await expect(
      service.changePassword(me.id, { currentPassword: '482913', newPassword: '705318' }, { sessionId: 's1' }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('refuse un nouveau code identique, trop facile, ou mal formé', async () => {
    const { service, addUser, users } = build();
    const me = addUser();
    await expect(
      service.changePassword(me.id, { currentPassword: '482913', newPassword: '482913' }, { sessionId: 's1' }),
    ).rejects.toThrow(/différent/);
    await expect(
      service.changePassword(me.id, { currentPassword: '482913', newPassword: '123456' }, { sessionId: 's1' }),
    ).rejects.toThrow(/trop facile/);
    await expect(
      service.changePassword(me.id, { currentPassword: '482913', newPassword: '12' }, { sessionId: 's1' }),
    ).rejects.toThrow(/6 chiffres/);
    expect(users[0]!.passwordHash).toBe(`hashed:${pinDigest('482913')}`);
  });

  it('compte sans mot de passe : on renvoie vers sa définition', async () => {
    const { service, addUser } = build();
    const me = addUser({ passwordHash: null });
    await expect(
      service.changePassword(me.id, { currentPassword: '482913', newPassword: '705318' }, { sessionId: 's1' }),
    ).rejects.toThrow(/choisissez-en un/);
  });
});
