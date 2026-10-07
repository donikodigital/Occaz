// backend/src/otp/otp-settings.service.spec.ts
// Réglages OTP : valeur de l'administration > variable d'environnement > valeur par défaut.
import { BadRequestException } from '@nestjs/common';
import { isPhoneAllowed, OtpSettingsService, parsePhonePrefixes } from './otp-settings.service';

const ENV_NAMES = [
  'OTP_EXPIRY_SECONDS',
  'OTP_MAX_ATTEMPTS',
  'OTP_REQUEST_LIMIT',
  'OTP_REQUEST_WINDOW_MINUTES',
  'OTP_DAILY_LIMIT_PER_PHONE',
  'OTP_DAILY_LIMIT_GLOBAL',
  'OTP_HANDOVER_SMS_DAILY_LIMIT',
  'OTP_ALLOWED_PHONE_PREFIXES',
  'PHONE_CHANGE_COOLDOWN_DAYS',
  'SMS_NOTIFICATION_DAILY_LIMIT_PER_USER',
];

function build(stored: Record<string, unknown> = {}) {
  const findMany = jest.fn().mockResolvedValue(Object.entries(stored).map(([key, value]) => ({ key, value })));
  const service = new OtpSettingsService({ platformSetting: { findMany } } as never);
  return { service, findMany };
}

beforeEach(() => ENV_NAMES.forEach((name) => delete process.env[name]));
afterAll(() => ENV_NAMES.forEach((name) => delete process.env[name]));

describe('OtpSettingsService.get', () => {
  it('sans rien d\'enregistré : valeurs par défaut', async () => {
    expect(await build().service.get()).toEqual({
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
    });
  });

  it('la variable d\'environnement remplace la valeur par défaut', async () => {
    process.env.OTP_EXPIRY_SECONDS = '600';
    process.env.OTP_REQUEST_LIMIT = '8';
    process.env.PHONE_CHANGE_COOLDOWN_DAYS = '0';
    process.env.OTP_ALLOWED_PHONE_PREFIXES = '+224';
    const settings = await build().service.get();
    expect(settings).toMatchObject({ expirySeconds: 600, requestLimit: 8, phoneChangeCooldownDays: 0, allowedPhonePrefixes: ['+224'] });
  });

  it('la valeur de l\'administration l\'emporte sur l\'environnement', async () => {
    process.env.OTP_EXPIRY_SECONDS = '600';
    process.env.OTP_ALLOWED_PHONE_PREFIXES = '+224';
    const { service } = build({ 'otp.expiry_seconds': 120, 'otp.allowed_phone_prefixes': '+33' });
    expect(await service.get()).toMatchObject({ expirySeconds: 120, allowedPhonePrefixes: ['+33'] });
  });

  it('une valeur invalide (texte, négatif, sous le minimum) est ignorée : on retombe sur l\'environnement puis le défaut', async () => {
    process.env.OTP_MAX_ATTEMPTS = '4';
    const { service } = build({
      'otp.max_attempts': 'beaucoup', // texte → environnement (4)
      'otp.expiry_seconds': 5, // sous le minimum de 30 s → défaut (300)
      'otp.request_limit': 0, // 0 bloquerait toute connexion → défaut (5)
      'otp.daily_limit_global': -1, // négatif → défaut (2000)
    });
    expect(await service.get()).toMatchObject({ maxAttempts: 4, expirySeconds: 300, requestLimit: 5, dailyLimitGlobal: 2000 });
  });

  it('0 est une valeur valide pour les plafonds quotidiens et le délai de changement de numéro (= illimité / aucun délai)', async () => {
    const { service } = build({
      'otp.daily_limit_per_phone': 0,
      'otp.daily_limit_global': 0,
      'otp.handover_sms_daily_limit': 0,
      'auth.phone_change_cooldown_days': 0,
      'sms.notification_daily_limit_per_user': 0,
    });
    expect(await service.get()).toMatchObject({
      dailyLimitPerPhone: 0,
      dailyLimitGlobal: 0,
      handoverSmsDailyLimit: 0,
      phoneChangeCooldownDays: 0,
      notificationSmsDailyLimitPerUser: 0,
    });
  });

  it('un nombre à virgule est arrondi vers le bas', async () => {
    expect(await build({ 'otp.max_attempts': 3.9 }).service.get()).toMatchObject({ maxAttempts: 3 });
  });

  it('« * » enregistré dans l\'administration = tous les pays, même si l\'environnement impose une liste', async () => {
    process.env.OTP_ALLOWED_PHONE_PREFIXES = '+224';
    expect((await build({ 'otp.allowed_phone_prefixes': '*' }).service.get()).allowedPhonePrefixes).toEqual([]);
  });

  it('lit tous les réglages en une seule requête', async () => {
    const { service, findMany } = build();
    await service.get();
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where.key.in).toHaveLength(10);
  });
});

describe('parsePhonePrefixes', () => {
  it('accepte virgules, points-virgules et espaces ; ajoute le « + » manquant ; retire les doublons', () => {
    expect(parsePhonePrefixes('+224, 33 ; +221 +224')).toEqual(['+224', '+33', '+221']);
  });

  it('écarte les entrées invalides', () => {
    expect(parsePhonePrefixes('abc, +, +12345678901, +224')).toEqual(['+224']);
  });

  it('texte vide ou « * » : liste vide (tous les pays)', () => {
    expect(parsePhonePrefixes('')).toEqual([]);
    expect(parsePhonePrefixes('*')).toEqual([]);
  });
});

describe('isPhoneAllowed / assertPhoneAllowed', () => {
  it('liste vide : tout est accepté', () => {
    expect(isPhoneAllowed('+14155550100', [])).toBe(true);
  });

  it('accepte un numéro dont l\'indicatif est dans la liste, refuse les autres', () => {
    expect(isPhoneAllowed('+224620000001', ['+224', '+33'])).toBe(true);
    expect(isPhoneAllowed('+14155550100', ['+224', '+33'])).toBe(false);
  });

  it('ne se laisse pas tromper par un indicatif qui n\'est qu\'un début de numéro étranger', () => {
    // « +2240… » commence bien par +224 ; « +22 4… » avec espace est normalisé ; « +2250… » (Côte d'Ivoire) ne passe pas.
    expect(isPhoneAllowed('+22 4620000001', ['+224'])).toBe(true);
    expect(isPhoneAllowed('+2250102030405', ['+224'])).toBe(false);
  });

  it('assertPhoneAllowed : message clair avec les indicatifs acceptés', () => {
    const { service } = build();
    const settings = { allowedPhonePrefixes: ['+224', '+33'] } as never;
    expect(() => service.assertPhoneAllowed('+14155550100', settings)).toThrow(BadRequestException);
    expect(() => service.assertPhoneAllowed('+14155550100', settings)).toThrow(/\+224, \+33/);
    expect(() => service.assertPhoneAllowed('+224620000001', settings)).not.toThrow();
  });
});
