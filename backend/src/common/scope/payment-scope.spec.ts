// backend/src/common/scope/payment-scope.spec.ts
// Portée par pays : paiement (GET /payments/:id), signalement et SOS (PATCH) — 404 hors périmètre, aucun effet sans portée.
import { NotFoundException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PERMISSIONS } from '../constants/permissions.constants';
import { CountryScopeService } from './country-scope.service';
import { PaymentsController } from '../../payments/payments.controller';
import { SosController, UserReportsController } from '../../user-safety/user-safety.controllers';

const scoped = (permission: string) => ({
  id: 'staff',
  accountType: AccountType.SUPPORT,
  permissions: [permission],
  scopedCountryIds: ['GN'],
  countryScopes: { [permission]: ['GN'] },
});
const global = (permission: string) => ({ ...scoped(permission), scopedCountryIds: [], countryScopes: {} });

describe('CountryScopeService.assertPayment', () => {
  it('ne requête rien pour un compte sans portée', async () => {
    const prisma = { payment: { count: jest.fn() } };
    await new CountryScopeService(prisma as never).assertPayment(global(PERMISSIONS.PAYMENT_READ) as never, PERMISSIONS.PAYMENT_READ, 'p1');
    expect(prisma.payment.count).not.toHaveBeenCalled();
  });

  it('laisse passer un paiement du périmètre (réservation OU envoi)', async () => {
    const prisma = { payment: { count: jest.fn().mockResolvedValue(1) } };
    await new CountryScopeService(prisma as never).assertPayment(scoped(PERMISSIONS.PAYMENT_READ) as never, PERMISSIONS.PAYMENT_READ, 'p1');
    const where = prisma.payment.count.mock.calls[0][0].where;
    expect(where.id).toBe('p1');
    expect(Object.keys(where.OR[0])).toEqual(['booking']);
    expect(Object.keys(where.OR[1])).toEqual(['shipment']);
  });

  it('répond 404 hors périmètre', async () => {
    const prisma = { payment: { count: jest.fn().mockResolvedValue(0) } };
    await expect(
      new CountryScopeService(prisma as never).assertPayment(scoped(PERMISSIONS.PAYMENT_READ) as never, PERMISSIONS.PAYMENT_READ, 'p1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('GET /payments/:id', () => {
  const payment = { id: 'p1', bookingId: 'b1', shipmentId: null, transactions: [{ id: 't1', status: 'SUCCESS', rawPayload: { secret: 1 } }] };

  function build() {
    const payments = { findOne: jest.fn().mockResolvedValue(payment), isOwnedByCustomer: jest.fn().mockResolvedValue(true) };
    const customers = { findByUserId: jest.fn().mockResolvedValue({ id: 'c1' }) };
    const scope = { assertPayment: jest.fn().mockResolvedValue(undefined) };
    return { controller: new PaymentsController(payments as never, customers as never, {} as never, scope as never), scope };
  }

  it('le personnel passe par la portée par pays et garde les données brutes', async () => {
    const { controller, scope } = build();
    const user = { id: 'staff', permissions: [PERMISSIONS.PAYMENT_READ] };
    const result = (await controller.findOne('p1', user as never)) as typeof payment;
    expect(scope.assertPayment).toHaveBeenCalledWith(user, PERMISSIONS.PAYMENT_READ, 'p1');
    expect(result.transactions[0]).toHaveProperty('rawPayload');
  });

  it('le client voit son paiement sans rawPayload et sans passer par la portée', async () => {
    const { controller, scope } = build();
    const result = (await controller.findOne('p1', { id: 'u1', permissions: [] } as never)) as typeof payment;
    expect(scope.assertPayment).not.toHaveBeenCalled();
    expect(result.transactions[0]).not.toHaveProperty('rawPayload');
    expect(result.transactions[0]).toHaveProperty('status', 'SUCCESS');
  });
});

describe('PATCH /reports/:id et /sos/:id', () => {
  it('signalement : vérifie la personne signalée avant de modifier', async () => {
    const reports = { reportedUserIdOf: jest.fn().mockResolvedValue('u9'), update: jest.fn().mockResolvedValue('ok') };
    const scope = { assertUser: jest.fn().mockResolvedValue(undefined) };
    const controller = new UserReportsController(reports as never, scope as never);
    const user = { id: 'staff' };
    await controller.update('r1', { status: 'RESOLVED' } as never, user as never);
    expect(scope.assertUser).toHaveBeenCalledWith(user, PERMISSIONS.USER_REPORT_MANAGE, 'u9');
    expect(reports.update).toHaveBeenCalled();
  });

  it('signalement : hors périmètre → rien n’est modifié', async () => {
    const reports = { reportedUserIdOf: jest.fn().mockResolvedValue('u9'), update: jest.fn() };
    const scope = { assertUser: jest.fn().mockRejectedValue(new NotFoundException()) };
    const controller = new UserReportsController(reports as never, scope as never);
    await expect(controller.update('r1', {} as never, { id: 'staff' } as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(reports.update).not.toHaveBeenCalled();
  });

  it('SOS : vérifie la personne en alerte avant de traiter', async () => {
    const sos = { userIdOf: jest.fn().mockResolvedValue('u7'), handle: jest.fn().mockResolvedValue('ok') };
    const scope = { assertUser: jest.fn().mockResolvedValue(undefined) };
    const controller = new SosController(sos as never, scope as never);
    const user = { id: 'staff' };
    await controller.handle('s1', { status: 'ACKNOWLEDGED' } as never, user as never);
    expect(scope.assertUser).toHaveBeenCalledWith(user, PERMISSIONS.SOS_MANAGE, 'u7');
    expect(sos.handle).toHaveBeenCalled();
  });

  it('SOS : hors périmètre → rien n’est traité', async () => {
    const sos = { userIdOf: jest.fn().mockResolvedValue('u7'), handle: jest.fn() };
    const scope = { assertUser: jest.fn().mockRejectedValue(new NotFoundException()) };
    const controller = new SosController(sos as never, scope as never);
    await expect(controller.handle('s1', {} as never, { id: 'staff' } as never)).rejects.toBeInstanceOf(NotFoundException);
    expect(sos.handle).not.toHaveBeenCalled();
  });
});
