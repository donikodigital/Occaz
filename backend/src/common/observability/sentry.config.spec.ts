// backend/src/common/observability/sentry.config.spec.ts
import type { ErrorEvent } from '@sentry/nestjs';
import { DATA_COLLECTION, buildSentryOptions, scrubEvent } from './sentry.config';

describe('buildSentryOptions', () => {
  it('sans SENTRY_DSN : suivi désactivé (null) — le backend ne contacte pas Sentry', () => {
    expect(buildSentryOptions({})).toBeNull();
    expect(buildSentryOptions({ SENTRY_DSN: '   ' })).toBeNull();
  });

  it('avec un DSN : options prudentes par défaut', () => {
    const options = buildSentryOptions({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1', NODE_ENV: 'production' });
    expect(options).toMatchObject({
      dsn: 'https://k@o1.ingest.sentry.io/1',
      environment: 'production',
      tracesSampleRate: 0, // le traçage consomme le quota gratuit : désactivé tant qu'on ne le demande pas
    });
    expect(typeof options?.beforeSend).toBe('function');
  });

  it('coupe toute collecte de données personnelles ou secrètes (corps, cookies, en-têtes, URL, IP, variables locales, SQL)', () => {
    const options = buildSentryOptions({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1' });
    expect(options?.dataCollection).toEqual(DATA_COLLECTION);
    expect(DATA_COLLECTION).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    });
  });

  it('environnement, version et traçage se règlent par variables', () => {
    const options = buildSentryOptions({
      SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1',
      SENTRY_ENVIRONMENT: 'staging',
      SENTRY_RELEASE: 'v1.2.3',
      SENTRY_TRACES_SAMPLE_RATE: '0.25',
    });
    expect(options).toMatchObject({ environment: 'staging', release: 'v1.2.3', tracesSampleRate: 0.25 });
  });

  it('version : le commit Render sert de repli', () => {
    const options = buildSentryOptions({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1', RENDER_GIT_COMMIT: 'df58541' });
    expect(options?.release).toBe('df58541');
  });

  it('taux de traçage invalide ou hors bornes : ramené entre 0 et 1', () => {
    const rate = (value: string) =>
      buildSentryOptions({ SENTRY_DSN: 'https://k@o1.ingest.sentry.io/1', SENTRY_TRACES_SAMPLE_RATE: value })?.tracesSampleRate;
    expect(rate('abc')).toBe(0);
    expect(rate('5')).toBe(1);
    expect(rate('-2')).toBe(0);
  });
});

describe('scrubEvent — aucune donnée personnelle ni secret ne part vers Sentry', () => {
  const event = (): ErrorEvent =>
    ({
      type: undefined,
      request: {
        method: 'POST',
        url: 'https://api.occaz.sarl/api/v1/auth/verify-otp?phone=%2B224620000000',
        query_string: 'phone=%2B224620000000',
        data: { phone: '+224620000000', code: '123456' },
        cookies: { session: 'abc' },
        headers: { Authorization: 'Bearer secret', Cookie: 'a=b', 'User-Agent': 'okhttp', 'X-Forwarded-For': '1.2.3.4' },
      },
      user: { id: 'u1', ip_address: '1.2.3.4', email: 'a@b.c', username: 'boubacar' },
      message: 'Boom',
    }) as unknown as ErrorEvent;

  it('retire le corps de la requête (codes, mots de passe, numéros), les cookies et les paramètres d\'URL', () => {
    const { request } = scrubEvent(event());
    expect(request?.data).toBeUndefined();
    expect(request?.cookies).toBeUndefined();
    expect(request?.query_string).toBeUndefined();
    expect(request?.url).toBe('https://api.occaz.sarl/api/v1/auth/verify-otp');
  });

  it('retire les en-têtes d\'authentification et d\'adresse, garde les autres', () => {
    const { request } = scrubEvent(event());
    expect(request?.headers).toEqual({ 'User-Agent': 'okhttp' });
  });

  it('ne garde de la personne que l\'identifiant du compte', () => {
    const { user } = scrubEvent(event());
    expect(user).toEqual({ id: 'u1' });
  });

  it('garde ce qui sert à comprendre l\'erreur (méthode, message)', () => {
    const scrubbed = scrubEvent(event());
    expect(scrubbed.request?.method).toBe('POST');
    expect(scrubbed.message).toBe('Boom');
  });

  it('un événement sans requête ni utilisateur passe tel quel', () => {
    const bare = { message: 'x' } as unknown as ErrorEvent;
    expect(scrubEvent(bare)).toEqual({ message: 'x' });
  });
});
