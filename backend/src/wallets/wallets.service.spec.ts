// backend/src/wallets/wallets.service.spec.ts
// Garde-fous du portefeuille conducteur : jamais de double crédit, revenu et commission toujours ensemble.
import { WalletTransactionStatus, WalletTransactionType } from '@prisma/client';
import { WalletsService } from './wallets.service';

function build(options: { pending?: Array<{ id: string; amount: bigint }>; claimCount?: number; already?: boolean; openDisputes?: number; walletUpdateCount?: number; balance?: bigint } = {}) {
  const wallet = { id: 'w1', driverId: 'dr1', currencyId: 'XOF', currency: { isoCode: 'XOF' }, balance: options.balance ?? 0n, pendingBalance: 0n, version: 0 };
  const tx = {
    walletTransaction: {
      findMany: jest.fn().mockResolvedValue(options.pending ?? []),
      findFirst: jest.fn().mockResolvedValue(options.already ? { id: 'existing' } : null),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? (options.pending ?? []).length }),
      create: jest.fn().mockResolvedValue({ id: 'wt' }),
    },
    wallet: { update: jest.fn().mockResolvedValue(wallet), updateMany: jest.fn().mockResolvedValue({ count: options.walletUpdateCount ?? 1 }) },
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'w1' }]),
  };
  const prisma = {
    wallet: { findUnique: jest.fn().mockResolvedValue(wallet) },
    driverProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'u1' }) },
    dispute: { count: jest.fn().mockResolvedValue(options.openDisputes ?? 0) },
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

  it('litige ouvert sur la réservation : les fonds restent en attente (rien n\'est libéré)', async () => {
    const { service, prisma, tx, notifications } = build({ pending, openDisputes: 1 });
    await service.releaseHeldFunds({ driverId: 'dr1', bookingId: 'b1' });
    expect(prisma.dispute.count).toHaveBeenCalledWith({
      where: { bookingId: 'b1', status: { notIn: ['RESOLVED', 'CLOSED'] }, resolution: { is: null } },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
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

describe('WalletsService.deductHeldFunds — remboursement partiel', () => {
  const params = { driverId: 'dr1', bookingId: 'b1', refundedAmount: 5_000n, paidAmount: 20_000n, reason: 'Remboursement partiel du client' };

  it('retire au conducteur sa part, au prorata : 25 % remboursés = 25 % de sa part nette en moins', async () => {
    // part nette en attente : 100 000 (revenu) − 15 000 (commission) = 85 000
    const { service, tx } = build({ pending: [{ id: 'a', amount: 100_000n }, { id: 'b', amount: -15_000n }] });
    await expect(service.deductHeldFunds(params)).resolves.toBe(true);
    const created = tx.walletTransaction.create.mock.calls[0][0].data;
    expect(created.amount).toBe(-21_250n);
    expect(created.type).toBe(WalletTransactionType.REFUND);
    expect(created.status).toBe(WalletTransactionStatus.PENDING);
    expect(tx.wallet.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pendingBalance: { increment: -21_250n } }) }));
  });

  it('fonds déjà libérés (plus rien en attente) : renvoie false, rien n’est écrit', async () => {
    const { service, tx } = build({ pending: [] });
    await expect(service.deductHeldFunds(params)).resolves.toBe(false);
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('ne retire jamais plus que ce qui est en attente', async () => {
    const { service, tx } = build({ pending: [{ id: 'a', amount: 1_000n }] });
    await service.deductHeldFunds({ ...params, refundedAmount: 50_000n });
    expect(tx.walletTransaction.create.mock.calls[0][0].data.amount).toBe(-1_000n);
  });

  it('sans référence ou sans montant : ne fait rien', async () => {
    const { service, tx } = build({ pending: [{ id: 'a', amount: 1_000n }] });
    await expect(service.deductHeldFunds({ ...params, bookingId: undefined })).resolves.toBe(false);
    await expect(service.deductHeldFunds({ ...params, refundedAmount: 0n })).resolves.toBe(false);
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });
});


describe('WalletsService.adjustBalance — pas de solde négatif par erreur', () => {
  it('un débit supérieur au solde disponible est refusé', async () => {
    const { service, tx } = build({ walletUpdateCount: 0 });
    await expect(service.adjustBalance('dr1', '-5000', 'Erreur de saisie', 'admin1')).rejects.toThrow(/négatif/);
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('le débit est une écriture conditionnelle : le solde doit couvrir le montant au moment de l\'écriture', async () => {
    const { service, tx } = build({ balance: 10_000n });
    await service.adjustBalance('dr1', '-5000', 'Correction', 'admin1');
    expect(tx.wallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'w1', balance: { gte: 5_000n } } }));
    expect(tx.walletTransaction.create.mock.calls[0][0].data.amount).toBe(-5_000n);
  });

  it('allowDebt : le débit est accepté même s\'il rend le solde négatif, et la dette est tracée', async () => {
    const { service, tx } = build({ balance: 0n });
    await service.adjustBalance('dr1', '-5000', 'Dette après remboursement', 'admin1', { allowDebt: true });
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.wallet.update).toHaveBeenCalled();
    expect(tx.walletTransaction.create.mock.calls[0][0].data.metadata).toEqual({ reason: 'Dette après remboursement', allowDebt: true });
  });

  it('un crédit n\'a aucune condition', async () => {
    const { service, tx } = build();
    await service.adjustBalance('dr1', '5000', 'Geste commercial', 'admin1');
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create.mock.calls[0][0].data.amount).toBe(5_000n);
  });
});

describe('WalletsService — retraits sans verrou de version', () => {
  it('reserveForPayout : une seule écriture conditionnelle sur le solde disponible (plus de conflit de version)', async () => {
    const { service, tx } = build({ balance: 50_000n });
    await service.reserveForPayout('dr1', 20_000n, 'p1');
    expect(tx.wallet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'w1', balance: { gte: 20_000n } } }),
    );
    expect(tx.walletTransaction.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ payoutId: 'p1', amount: -20_000n }));
  });

  it('reserveForPayout : solde consommé entre-temps → refus clair, aucune ligne créée', async () => {
    const { service, tx } = build({ balance: 50_000n, walletUpdateCount: 0 });
    await expect(service.reserveForPayout('dr1', 20_000n, 'p1')).rejects.toThrow(/Solde insuffisant/);
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('finalizePayout : idempotent — déjà finalisé, le solde en attente n\'est pas débité une seconde fois', async () => {
    const { service, tx } = build({ claimCount: 0 });
    await service.finalizePayout('dr1', 20_000n, 'p1');
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });

  it('finalizePayout : débite le solde en attente après avoir réclamé la ligne', async () => {
    const { service, tx } = build({ claimCount: 1 });
    await service.finalizePayout('dr1', 20_000n, 'p1');
    expect(tx.walletTransaction.updateMany).toHaveBeenCalledWith({ where: { payoutId: 'p1', status: WalletTransactionStatus.PENDING }, data: { status: WalletTransactionStatus.COMPLETED } });
    expect(tx.wallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'w1', pendingBalance: { gte: 20_000n } } }));
  });

  it('reversePayout : rend la somme au solde disponible, une seule fois', async () => {
    const { service, tx } = build({ claimCount: 1 });
    await service.reversePayout('dr1', 20_000n, 'p1');
    expect(tx.wallet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pendingBalance: { decrement: 20_000n }, balance: { increment: 20_000n } }) }),
    );
    const again = build({ claimCount: 0 });
    await again.service.reversePayout('dr1', 20_000n, 'p1');
    expect(again.tx.wallet.updateMany).not.toHaveBeenCalled();
  });
});
