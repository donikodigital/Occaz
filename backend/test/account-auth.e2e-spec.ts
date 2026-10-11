// backend/test/account-auth.e2e-spec.ts
// [11/10/2026] v1 — Parcours complet client, de bout en bout, sur l'application Nest réelle et une VRAIE base PostgreSQL (celle de la CI) :
//   inscription (SMS → e-mail → mot de passe) → connexion → verrouillage après 5 erreurs → mot de passe oublié par e-mail → changement
//   du mot de passe connecté → mot de passe oublié par SMS.
// Seuls les envois de SMS et d'e-mails sont remplacés par des boîtes de capture (c'est là qu'on lit les codes) ; tout le reste — routes,
// validation, garde JWT, Prisma, bcrypt — est le vrai code. Un numéro aléatoire par exécution : le test peut tourner sur une base partagée.
//
// Usage : DATABASE_URL="postgresql://..." npm run test:e2e   (comme health.e2e-spec.ts ; migrations déjà appliquées)
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER } from '../src/integrations/sms/sms-provider.interface';
import { EMAIL_PROVIDER } from '../src/integrations/email/email-provider.interface';

const API = '/api/v1/auth';

/** Numéro guinéen valide et unique à chaque exécution (+224 62 + 7 chiffres). */
const PHONE = `+22462${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
const EMAIL = `e2e.${Date.now()}@exemple.com`;

describe('Compte client — inscription, connexion, mot de passe (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sms: { to: string; message: string }[] = [];
  const emails: { to: string; subject: string; body: string }[] = [];

  /** Dernier code à 6 chiffres envoyé à ce destinataire. */
  const lastSmsCode = () => /\b(\d{6})\b/.exec(sms.filter((m) => m.to === PHONE).at(-1)?.message ?? '')?.[1] ?? '';
  const lastEmailCode = () => /\b(\d{6})\b/.exec(emails.filter((m) => m.to === EMAIL).at(-1)?.body ?? '')?.[1] ?? '';

  const post = (path: string, body: object, token?: string) => {
    const req = request(app.getHttpServer()).post(`${API}/${path}`).send(body);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };
  const login = (password: string) => post('login/phone', { phone: PHONE, password, expectedAccountType: 'CUSTOMER' });

  let accessToken = '';

  beforeAll(async () => {
    // Les limites par adresse IP (10 connexions / minute) sont testées à part : ce parcours enchaîne plus d'appels que la limite.
    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SMS_PROVIDER)
      .useValue({ send: async (to: string, message: string) => void sms.push({ to, message }) })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue({ send: async (to: string, subject: string, body: string) => void emails.push({ to, subject, body }) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    try {
      const user = await prisma.user.findUnique({ where: { phone: PHONE } });
      if (user) {
        await prisma.otpCode.deleteMany({ where: { userId: user.id } });
        await prisma.session.deleteMany({ where: { userId: user.id } });
        await prisma.device.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
      }
    } catch {
      // Nettoyage au mieux (journaux d'audit liés, etc.) : la base de la CI est jetable, et le numéro est unique à l'exécution.
    }
    await app.close();
  });

  it('refuse un numéro mal formé avant d’envoyer le moindre SMS', async () => {
    await post('signup/phone', { phone: '12', accountType: 'CUSTOMER' }).expect(400);
    expect(sms).toHaveLength(0);
  });

  it('inscription 1 : le numéro reçoit un code SMS immédiatement', async () => {
    await post('signup/phone', { phone: PHONE, accountType: 'CUSTOMER' }).expect(200);
    expect(sms).toHaveLength(1);
    expect(lastSmsCode()).toMatch(/^\d{6}$/);
  });

  it('inscription 2 : un faux code est refusé, le bon ouvre la session', async () => {
    const wrong = lastSmsCode() === '000001' ? '000002' : '000001';
    await post('signup/phone/verify', { phone: PHONE, code: wrong }).expect(401);

    const res = await post('signup/phone/verify', { phone: PHONE, code: lastSmsCode() }).expect(200);
    accessToken = res.body.data.accessToken;
    expect(accessToken).toBeTruthy();
    expect(res.body.data.user.phone).toBe(PHONE);
    expect(res.body.data.user.mustSetPassword).toBe(true);
  });

  it('le même code ne sert qu’une fois', async () => {
    await post('signup/phone/verify', { phone: PHONE, code: lastSmsCode() }).expect(401);
  });

  it('inscription 3 : l’e-mail (facultatif) est vérifié par un code reçu dans la boîte mail', async () => {
    await post('email/request', { email: EMAIL }, accessToken).expect(200);
    expect(emails).toHaveLength(1);
    const res = await post('email/verify', { email: EMAIL, code: lastEmailCode() }, accessToken).expect(200);
    expect(res.body.data.email).toBe(EMAIL);
    expect(res.body.data.isEmailVerified).toBe(true);
  });

  it('inscription 4 : un mot de passe trop facile est refusé, un bon est enregistré', async () => {
    await post('password/set', { password: '123456' }, accessToken).expect(400);
    await post('password/set', { password: '1234' }, accessToken).expect(400);
    const res = await post('password/set', { password: '482913' }, accessToken).expect(200);
    expect(res.body.data.mustSetPassword).toBe(false);
    // Le mot de passe n’est défini qu’une fois par ce chemin.
    await post('password/set', { password: '705318' }, accessToken).expect(400);
  });

  it('connexion : numéro + mot de passe, sans SMS supplémentaire', async () => {
    const smsBefore = sms.length;
    const res = await login('482913').expect(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(sms).toHaveLength(smsBefore);
  });

  it('le SMS de connexion à l’ancienne est fermé aux clients', async () => {
    const res = await post('otp/request', { phone: PHONE });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(sms.filter((m) => m.to === PHONE)).toHaveLength(1); // seulement celui de l’inscription
  });

  it('5 erreurs de suite verrouillent le compte, même avec le bon mot de passe', async () => {
    for (let i = 0; i < 4; i += 1) await login('999000').expect(401);
    await login('999000').expect(429);
    await login('482913').expect(429);
  });

  it('mot de passe oublié par e-mail : code, nouveau mot de passe, compte déverrouillé', async () => {
    const request1 = await post('forgot-password/request', { phone: PHONE, channel: 'EMAIL' }).expect(200);
    expect(request1.body.data.destination).toContain('@');
    expect(request1.body.data.destination).not.toBe(EMAIL); // adresse masquée

    const verified = await post('forgot-password/verify', { phone: PHONE, code: lastEmailCode() }).expect(200);
    const { resetToken } = verified.body.data;
    expect(resetToken).toBeTruthy();

    await post('forgot-password/reset', { resetToken, newPassword: '111111' }).expect(400);
    await post('forgot-password/reset', { resetToken, newPassword: '705318' }).expect(200);
    // Le jeton ne sert qu’une fois.
    await post('forgot-password/reset', { resetToken, newPassword: '190274' }).expect(401);

    await login('482913').expect(401);
    await login('705318').expect(200);
  });

  it('changement du mot de passe connecté : il faut l’actuel', async () => {
    const session = await login('705318').expect(200);
    const token = session.body.data.accessToken;

    await post('password/change', { currentPassword: '000999', newPassword: '314159' }, token).expect(400);
    await post('password/change', { currentPassword: '705318', newPassword: '705318' }, token).expect(400);
    await post('password/change', { currentPassword: '705318', newPassword: '314159' }, token).expect(200);

    await login('705318').expect(401);
    await login('314159').expect(200);
  });

  it('mot de passe oublié par SMS : le code part au numéro, un faux code est refusé', async () => {
    const smsBefore = sms.length;
    await post('forgot-password/request', { phone: PHONE, channel: 'SMS' }).expect(200);
    expect(sms).toHaveLength(smsBefore + 1);

    const wrong = lastSmsCode() === '000001' ? '000002' : '000001';
    await post('forgot-password/verify', { phone: PHONE, code: wrong }).expect(401);
    await post('forgot-password/verify', { phone: PHONE, code: lastSmsCode() }).expect(200);
  });

  it('un numéro inconnu reçoit la même réponse qu’un mauvais mot de passe', async () => {
    const res = await post('login/phone', { phone: '+224629999999', password: '482913' });
    expect(res.status).toBe(401);
  });
});
