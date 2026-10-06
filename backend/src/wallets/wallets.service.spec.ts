// backend/src/wallets/wallets.service.spec.ts
// Garde-fous du portefeuille conducteur : jamais de double crédit, revenu et commission toujours ensemble.
import { WalletTransactionStatus, WalletTransactionType } from '@prisma/client';
import { WalletsService } from './wallets.service';

function build(options: { pending?: Array<{ id: string; amount: bigint }>; claimCount?: number; already?: boolean } = {}) {
  const wallet = { id: 'w1', driverId: 'dr1', currencyId: 'XOF', currency: { isoCode: 'XOF' }, balance: 0n, pendingBalance: 0n, version: 0 };
  const tx = {
    walletTransaction: {
      findMany: jest.fn().mockResolvedValue(options.pending ?? []),
      findFirst: jest.fn().mockResolvedValue(options.already ? { id: 'existing' } : null),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? (options.pending ?? []).length }),
      create: jest.fn().mockResolvedValue({ id: 'wt' }),
    },
    wallet: { update: jest.fn().mockResolvedValue(wallet) },
  };
  const prisma = {
    wallet: { findUnique: jest.fn().mockResolvedValue(wallet) },
    driverProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'u1' }) },
    $transaction: jest.fn().mockImplementation((callback: (client: unknown) => unknown) => callback(tx)),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const exchangeRates = {
    convert: jest.fn().mockImplementation(async (amount: bigint) => ({ amount, conversion: undefined })),
  };
  const service = new WalletsService(prisma as never, { log: jest.fn() } as never, notifications as never, exchangeRates as never);
  return { service, prisma, tx, notifications };
}

describe('WalletsService.holdBookingRevenue', () => {
  it('enregistre le revenu et la commission dans UNE seule transaction', async () => {
    const { service, prisma, tx } = build();
    await service.holdBookingRevenue({
      driverId: 'dr1',
      bookingId: 'b1',
      grossAmount: 100_000n,
      commission: 15_000n,
      sourceCurrencyId: 'GNF',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const rows = tx.walletTransaction.create.mock.calls.map((call) => call[0].data);
    expect(rows.map((r: { type: WalletTransactionType }) => r.type)).toEqual([
      WalletTransactionType.BOOKING_REVENUE,
      WalletTransactionType.COMMISSION,
    ]);
    expect(rows.map((r: { amount: bigint }) => r.amount)).toEqual([100_000n, -15_000n]);
    expect(rows.every((r: { status: WalletTransactionStatus }) => r.status === WalletTransactionStatus.PENDING)).toBe(true);
  });

  it('est idempotent : un revenu déjà enregistré n\'est jamais compté deux fois', async () => {
    const { service, tx } = build({ already: true });
    await service.holdBookingRevenue({
      driverId: 'dr1',
      bookingId: 'b1',
      grossAmount: 100_000n,
      commission: 15_000n,
      sourceCurrencyId: 'GNF',
    });
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('un envoi suit la même règle (type SHIPMENT_REVENUE)', async () => {
    const { service, tx } = build();
    await service.holdShipmentRevenue({
      driverId: 'dr1',
      shipmentId: 's1',
      grossAmount: 150_000n,
      commission: 15_000n,
      sourceCurrencyId: 'GNF',
    });
    const types = tx.walletTransaction.create.mock.calls.map((call) => call[0].data.type);
    expect(types).toEqual([WalletTransactionType.SHIPMENT_REVENUE, WalletTransactionType.COMMISSION]);
  });
});

describe('WalletsService.releaseHeldFunds', () => {
  const pending = [
    { id: 't1', amount: 100_000n },
    { id: 't2', amount: -15_000n },
  ];

  it('bascule le net (revenu − commission) du solde en attente vers le solde disponible', async () => {
    const { service, tx, notifications } = build({ pending });
    await service.releaseHeldFunds({ driverId: 'dr1', bookingId: 'b1' });

    expect(tx.wallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pendingBalance: { decrement: 85_000n },
          balance: { increment: 85_000n },
        }),
      }),
    );
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('la notification de crédit dit la devise du portefeuille (« 85 000 XOF », jamais un chiffre nu)', async () => {
    const { service, notifications } = build({ pending });
    await service.releaseHeldFunds({ driverId: 'dr1', bookingId: 'b1' });
    const body: string = notifications.notify.mock.calls[0][0].fallbackBody;
    expect(body).toMatch(/^85\s000 XOF ont été ajoutés à votre solde disponible\.$/);
  });

  it('ne crédite rien si un autre appel vient de libérer les mêmes lignes (0 ligne réclamée)', async () => {
    const { service, tx, notifications } = build({ pending, claimCount: 0 });
    await service.releaseHeldFunds({ driverId: 'dr1', bookingId: 'b1' });
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('annule tout (erreur) si seule une partie des lignes a pu être réclamée', async () => {
    const { service } = build({ pending, claimCount: 1 });
    await expect(service.releaseHeldFunds({ driverId: 'dr1', bookingId: 'b1' })).rejects.toThrow(/concurrente/);
  });

  it('sans référence de réservation ni d\'envoi, ne touche à rien (le filtre prendrait toutes les lignes)', async () => {
    const { service, prisma } = build({ pending });
    await service.releaseHeldFunds({ driverId: 'dr1' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ne fait rien s\'il n\'y a rien en attente', async () => {
    const { service, tx } = build({ pending: [] });
    await service.releaseHeldFunds({ driverId: 'dr1', bookingId: 'b1' });
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });
});

describe('WalletsService.reverseHeldFunds', () => {
  const pending = [
    { id: 't1', amount: 100_000n },
    { id: 't2', amount: -15_000n },
  ];

  it('retire le net du solde en attente et marque les lignes comme annulées, dans la même transaction', async () => {
    const { service, prisma, tx } = build({ pending });
    await service.reverseHeldFunds({ driverId: 'dr1', bookingId: 'b1', reason: 'Annulation' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.walletTransaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: WalletTransactionStatus.REVERSED } }),
    );
    expect(tx.wallet.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pendingBalance: { increment: -85_000n } }) }),
    );
  });

  it('est idempotent : une seconde reprise (lignes déjà annulées) ne retire rien', async () => {
    const { service, tx } = build({ pending, claimCount: 0 });
    await service.reverseHeldFunds({ driverId: 'dr1', bookingId: 'b1', reason: 'Annulation' });
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });
});
