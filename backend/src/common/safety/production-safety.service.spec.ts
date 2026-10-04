// backend/src/common/safety/production-safety.service.spec.ts
import { PaymentProviderType } from '@prisma/client';
import { SimulatedPaymentProvider } from '../../payments/providers/simulated-payment.provider';
import { ProductionSafetyService } from './production-safety.service';

const long = (c: string) => c.repeat(40);

const SAFE_ENV: NodeJS.ProcessEnv = {
  TEXTBEE_API_KEY: 'k',
  RESEND_API_KEY: 'k',
  MAPBOX_ACCESS_TOKEN: 'k',
  CORS_ALLOWED_ORIGINS: 'https://occaz.sarl',
  JWT_ACCESS_SECRET: long('a'),
  JWT_REFRESH_SECRET: long('b'),
  OTP_HASH_PEPPER: long('c'),
};

function build(simulated: boolean) {
  const real = { initiate: jest.fn() };
  const registry = { resolve: jest.fn().mockReturnValue(simulated ? new SimulatedPaymentProvider() : real) };
  return new ProductionSafetyService(registry as never);
}

describe('ProductionSafetyService.collectIssues', () => {
  it('ne signale rien quand tout est correctement branché', () => {
    expect(build(false).collectIssues(SAFE_ENV)).toEqual([]);
  });

  it('signale les paiements simulés', () => {
    const issues = build(true).collectIssues(SAFE_ENV);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('Paiements simulés');
    expect(issues[0]).toContain(PaymentProviderType.ORANGE_MONEY);
  });

  it('signale le mode test d\'authentification', () => {
    const issues = build(false).collectIssues({ ...SAFE_ENV, AUTH_TEST_MODE_ENABLED: 'true' });
    expect(issues.join(' ')).toContain('AUTH_TEST_MODE_ENABLED');
  });

  it('signale SMS, email, cartographie et CORS manquants', () => {
    const issues = build(false).collectIssues({
      ...SAFE_ENV,
      TEXTBEE_API_KEY: '',
      RESEND_API_KEY: undefined,
      MAPBOX_ACCESS_TOKEN: undefined,
      CORS_ALLOWED_ORIGINS: '  ',
    });
    expect(issues).toHaveLength(4);
  });

  it('signale un secret trop court et des secrets identiques', () => {
    const short = build(false).collectIssues({ ...SAFE_ENV, JWT_ACCESS_SECRET: 'court' });
    expect(short.join(' ')).toContain('JWT_ACCESS_SECRET trop court');

    const same = build(false).collectIssues({ ...SAFE_ENV, JWT_REFRESH_SECRET: long('a') });
    expect(same.join(' ')).toContain('trois valeurs différentes');
  });

  it('signale une documentation d\'API publique', () => {
    expect(build(false).collectIssues({ ...SAFE_ENV, SWAGGER_ENABLED: 'true' }).join(' ')).toContain('SWAGGER_ENABLED');
  });
});

describe('ProductionSafetyService.onApplicationBootstrap', () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, STRICT: process.env.PRODUCTION_STRICT };
  afterEach(() => {
    process.env.NODE_ENV = previous.NODE_ENV;
    if (previous.STRICT === undefined) delete process.env.PRODUCTION_STRICT;
    else process.env.PRODUCTION_STRICT = previous.STRICT;
  });

  it('hors production : ne contrôle rien', () => {
    process.env.NODE_ENV = 'development';
    const service = build(true);
    const spy = jest.spyOn(service, 'collectIssues');
    service.onApplicationBootstrap();
    expect(spy).not.toHaveBeenCalled();
  });

  it('en production sans mode strict : avertit mais laisse démarrer', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PRODUCTION_STRICT;
    expect(() => build(true).onApplicationBootstrap()).not.toThrow();
  });

  it('en production avec PRODUCTION_STRICT=true : refuse de démarrer tant qu\'il reste une alerte', () => {
    process.env.NODE_ENV = 'production';
    process.env.PRODUCTION_STRICT = 'true';
    expect(() => build(true).onApplicationBootstrap()).toThrow(/Démarrage refusé/);
  });
});
