// backend/src/wallets/held-funds-recovery.service.spec.ts
// Reprise des fonds restés en attente : libération des prestations terminées, mise en attente des envois sans revenu.
import { BookingStatus, ShipmentStatus, WalletTransactionStatus } from '@prisma/client';
import { HeldFundsRecoveryService, HELD_FUNDS_GRACE_MS } from './held-funds-recovery.service';

function build(options: { bookingRows?: unknown[]; shipmentRows?: unknown[]; orphanShipments?: unknown[]; enabled?: number; releaseFails?: string } = {}) {
  const prisma = {
    walletTransaction: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(options.bookingRows ?? [])
        .mockResolvedValueOnce(options.shipmentRows ?? []),
    },
    shipment: {
      findMany: jest.fn().mockResolvedValue(options.orphanShipments ?? []),
      findUnique: jest.fn().mockResolvedValue({ driverId: 'dr1', totalAmount: 10_000n, platformFee: 1_500n, currencyId: 'GNF' }),
    },
  };
  const wallets = {
    releaseHeldFunds: jest.fn().mockImplementation((target: { bookingId?: string }) =>
      options.releaseFails && target.bookingId === options.releaseFails ? Promise.reject(new Error('base indisponible')) : Promise.resolve(undefined),
    ),
    holdShipmentRevenue: jest.fn().mockResolvedValue(undefined),
  };
  const pricing = { getNumericSetting: jest.fn().mockResolvedValue(options.enabled ?? 1) };
  const service = new HeldFundsRecoveryService(prisma as never, wallets as never, pricing as never);
  return { service, prisma, wallets, pricing };
}

const row = (bookingId: string) => ({ bookingId, wallet: { driverId: 'dr1' } });
const shipRow = (shipmentId: string) => ({ shipmentId, wallet: { driverId: 'dr1' } });

describe('HeldFundsRecoveryService.runOnce', () => {
  it('libère les fonds en attente des réservations déposées / absents et des colis livrés', async () => {
    const { service, wallets } = build({ bookingRows: [row('b1'), row('b2')], shipmentRows: [shipRow('s1')] });
    const result = await service.runOnce();
    expect(result).toEqual({ released: 3, held: 0, failed: 0 });
    expect(wallets.releaseHeldFunds).toHaveBeenCalledWith({ driverId: 'dr1', bookingId: 'b1' });
    expect(wallets.releaseHeldFunds).toHaveBeenCalledWith({ driverId: 'dr1', bookingId: 'b2' });
    expect(wallets.releaseHeldFunds).toHaveBeenCalledWith({ driverId: 'dr1', shipmentId: 's1' });
  });

  it('ne regarde que les lignes encore EN ATTENTE, de prestations terminées depuis plus du délai de grâce', async () => {
    const now = new Date('2026-10-30T12:00:00.000Z');
    const { service, prisma } = build();
    await service.runOnce(now);
    const bookingWhere = prisma.walletTransaction.findMany.mock.calls[0][0].where;
    expect(bookingWhere.status).toBe(WalletTransactionStatus.PENDING);
    expect(bookingWhere.booking.updatedAt.lt).toEqual(new Date(now.getTime() - HELD_FUNDS_GRACE_MS));
    expect(bookingWhere.booking.OR).toEqual(
      expect.arrayContaining([{ status: BookingStatus.COMPLETED }, expect.objectContaining({ status: BookingStatus.CANCELLED })]),
    );
    const shipmentWhere = prisma.walletTransaction.findMany.mock.calls[1][0].where;
    expect(shipmentWhere.shipment.status.in).toEqual([ShipmentStatus.DELIVERED, ShipmentStatus.COMPLETED]);
  });

  it('un échec n\'empêche pas les suivants et il est compté', async () => {
    const { service, wallets } = build({ bookingRows: [row('b1'), row('b2')], releaseFails: 'b1' });
    const result = await service.runOnce();
    expect(result).toEqual({ released: 1, held: 0, failed: 1 });
    expect(wallets.releaseHeldFunds).toHaveBeenCalledTimes(2);
  });

  it('rattrape un envoi confié dont le revenu n\'a jamais été mis en attente', async () => {
    const { service, wallets } = build({ orphanShipments: [{ id: 's9' }] });
    const result = await service.runOnce();
    expect(result.held).toBe(1);
    expect(wallets.holdShipmentRevenue).toHaveBeenCalledWith({
      driverId: 'dr1', shipmentId: 's9', grossAmount: 10_000n, commission: 1_500n, sourceCurrencyId: 'GNF',
    });
  });

  it('interrupteur de l\'administration coupé : aucune requête, aucune libération', async () => {
    const { service, prisma, wallets, pricing } = build({ enabled: 0, bookingRows: [row('b1')] });
    const result = await service.runOnce();
    expect(pricing.getNumericSetting).toHaveBeenCalledWith('jobs.held_funds_recovery_enabled', 1);
    expect(result).toEqual({ released: 0, held: 0, failed: 0 });
    expect(prisma.walletTransaction.findMany).not.toHaveBeenCalled();
    expect(wallets.releaseHeldFunds).not.toHaveBeenCalled();
  });

  it('pas de passage en double : un second appel pendant le premier ne fait rien', async () => {
    const { service, prisma } = build();
    await Promise.all([service.runOnce(), service.runOnce()]);
    expect(prisma.walletTransaction.findMany).toHaveBeenCalledTimes(2); // un seul passage = deux requêtes
  });
});
