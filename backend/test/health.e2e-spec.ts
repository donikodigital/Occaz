// backend/test/health.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Premier test end-to-end du projet — sert de fondation, pas une
 * couverture exhaustive. Contrairement aux tests unitaires
 * (src/**\/*.spec.ts, qui ne dépendent que de Jest et tournent sans
 * rien de plus), celui-ci démarre l'application Nest RÉELLE, y compris
 * PrismaService qui appelle $connect() au démarrage — une DATABASE_URL
 * valide et joignable est donc requise, idéalement une base de test
 * dédiée (ex: une branche Neon séparée de la production) plutôt que la
 * base de développement partagée.
 *
 * Usage : DATABASE_URL="postgresql://..." npm run test:e2e
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health répond 200 sans dépendre de la base (liveness)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('ok');
      });
  });

  it('GET /health/ready confirme que la base répond (readiness)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect((res) => {
        expect(res.body.data.status).toBe('ok');
        expect(res.body.data.database).toBe('connected');
      });
  });
});
