// backend/src/common/filters/global-exception.filter.http.spec.ts
// Test de bout en bout (vraie requête HTTP) : branché comme dans AppModule (APP_FILTER), le filtre global garde les réponses
// d'avant pour les erreurs normales et ne remonte à Sentry que les pannes.
import { BadRequestException, Controller, Get, INestApplication, ServiceUnavailableException } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { GlobalExceptionFilter } from './global-exception.filter';

const mockCapture = jest.fn();
jest.mock('@sentry/nestjs', () => ({
  captureException: (...args: unknown[]) => mockCapture(...args),
  withScope: (callback: (scope: { setTag: jest.Mock; setUser: jest.Mock }) => void) =>
    callback({ setTag: jest.fn(), setUser: jest.fn() }),
}));

@Controller('probe')
class ProbeController {
  @Get('validation') validation() { throw new BadRequestException('Code invalide'); }
  @Get('unavailable') unavailable() { throw new ServiceUnavailableException('SMS indisponible'); }
  @Get('duplicate') duplicate() { throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 't', meta: { target: ['phone'] } }); }
  @Get('bug') bug(): never { throw new TypeError('Cannot read properties of undefined'); }
}

describe('GlobalExceptionFilter — branché comme dans AppModule', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => mockCapture.mockClear());

  it('refus normal (400) : enveloppe d\'erreur habituelle, rien envoyé à Sentry', async () => {
    const res = await request(app.getHttpServer()).get('/probe/validation').expect(400);
    expect(res.body).toMatchObject({ success: false, error: { statusCode: 400, message: 'Code invalide', path: '/probe/validation' } });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('doublon Prisma (P2002) : 409 « existe déjà », rien envoyé à Sentry', async () => {
    const res = await request(app.getHttpServer()).get('/probe/duplicate').expect(409);
    expect(res.body.error.message).toContain('phone');
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it('service indisponible (503) : réponse habituelle ET remontée', async () => {
    const res = await request(app.getHttpServer()).get('/probe/unavailable').expect(503);
    expect(res.body).toMatchObject({ success: false, error: { statusCode: 503 } });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });

  it('bug inattendu : 500 au format Nest par défaut ET remontée', async () => {
    const res = await request(app.getHttpServer()).get('/probe/bug').expect(500);
    expect(res.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
});
