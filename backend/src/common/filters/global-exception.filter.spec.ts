// backend/src/common/filters/global-exception.filter.spec.ts
// Le filtre global garde les réponses d'avant et ne remonte à Sentry que les vraies erreurs serveur.
import { BadRequestException, ConflictException, HttpStatus, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalExceptionFilter } from './global-exception.filter';

const mockCapture = jest.fn();
const scope = { setTag: jest.fn(), setUser: jest.fn() };
jest.mock('@sentry/nestjs', () => ({
  captureException: (...args: unknown[]) => mockCapture(...args),
  withScope: (callback: (s: typeof scope) => void) => callback(scope),
}));

function host(type: 'http' | 'rpc' = 'http') {
  const json = jest.fn();
  const response = { status: jest.fn().mockReturnValue({ json }), json };
  const request = { method: 'POST', url: '/api/v1/bookings/abc?phone=1', route: { path: '/api/v1/bookings/:id' }, user: { id: 'u1' } };
  const argumentsHost = {
    getType: () => type,
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  };
  return { argumentsHost: argumentsHost as never, response, json };
}

const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError('boom', { code, clientVersion: 'test' });

beforeEach(() => {
  mockCapture.mockClear();
  scope.setTag.mockClear();
  scope.setUser.mockClear();
});

describe('GlobalExceptionFilter — réponses inchangées', () => {
  it.each([
    [new BadRequestException('Code invalide'), 400],
    [new NotFoundException('Introuvable'), 404],
    [new ConflictException('Déjà pris'), 409],
  ])('exception HTTP %# : même enveloppe qu\'avant, et rien envoyé à Sentry', (exception, status) => {
    const { argumentsHost, response, json } = host();
    new GlobalExceptionFilter().catch(exception, argumentsHost);
    expect(response.status).toHaveBeenCalledWith(status);
    expect(json.mock.calls[0][0]).toMatchObject({ success: false, error: { statusCode: status } });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it.each([['P2002', 409], ['P2003', 400], ['P2025', 404]])('erreur Prisma %s : traduite en %s, rien envoyé à Sentry', (code, status) => {
    const { argumentsHost, response } = host();
    new GlobalExceptionFilter().catch(prismaError(code), argumentsHost);
    expect(response.status).toHaveBeenCalledWith(status);
    expect(mockCapture).not.toHaveBeenCalled();
  });
});

describe('GlobalExceptionFilter — vraies erreurs serveur remontées', () => {
  it('exception HTTP >= 500 : réponse d\'avant ET remontée', () => {
    const { argumentsHost, response } = host();
    const exception = new ServiceUnavailableException('SMS indisponible');
    new GlobalExceptionFilter().catch(exception, argumentsHost);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(mockCapture).toHaveBeenCalledWith(exception);
  });

  it('erreur Prisma non prévue : réponse 500 d\'avant ET remontée', () => {
    const { argumentsHost, response } = host();
    const exception = prismaError('P2024');
    new GlobalExceptionFilter().catch(exception, argumentsHost);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(mockCapture).toHaveBeenCalledWith(exception);
  });

  it('bug inattendu : 500 identique à celui de Nest par défaut, et remontée', () => {
    const { argumentsHost, response, json } = host();
    const exception = new TypeError('Cannot read properties of undefined');
    new GlobalExceptionFilter().catch(exception, argumentsHost);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
    expect(mockCapture).toHaveBeenCalledWith(exception);
  });

  it('la remontée porte la ROUTE (sans valeurs) et l\'identifiant du compte, rien d\'autre', () => {
    const { argumentsHost } = host();
    new GlobalExceptionFilter().catch(new Error('x'), argumentsHost);
    expect(scope.setTag).toHaveBeenCalledWith('route', 'POST /api/v1/bookings/:id');
    expect(scope.setUser).toHaveBeenCalledWith({ id: 'u1' });
    expect(JSON.stringify([scope.setTag.mock.calls, scope.setUser.mock.calls])).not.toContain('phone=1');
  });

  it('contexte non HTTP : remonté sans répondre', () => {
    const { argumentsHost, response } = host('rpc');
    const exception = new Error('tâche');
    new GlobalExceptionFilter().catch(exception, argumentsHost);
    expect(mockCapture).toHaveBeenCalledWith(exception);
    expect(response.status).not.toHaveBeenCalled();
  });
});
