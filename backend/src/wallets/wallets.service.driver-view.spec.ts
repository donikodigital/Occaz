// backend/src/wallets/wallets.service.driver-view.spec.ts
// Historique du portefeuille côté conducteur : filtre par catégorie, totaux de toutes les catégories, lignes enrichies.
import { WalletTransactionStatus as S, WalletTransactionType as T } from '@prisma/client';
import { WalletsService } from './wallets.service';

let seq = 0;
const ledger = (over: Record<string, unknown>) => ({
  id: `r${++seq}`, walletId: 'w1', status: S.COMPLETED, currencyId: 'xof',
  bookingId: null, shipmentId: null, payoutId: null, metadata: null,
  createdAt: new Date(Date.UTC(2026, 9, 4, 12, seq)), ...over,
});

function build() {
  const rows = [
    ledger({ type: T.BOOKING_REVENUE, amount: 4_456n, bookingId: 'b1' }),
    ledger({ type: T.COMMISSION, amount: -581n, bookingId: 'b1' }),
    ledger({ type: T.SHIPMENT_REVENUE, amount: 762n, shipmentId: 's1' }),
    ledger({ type: T.COMMISSION, amount: -100n, shipmentId: 's1' }),
    ledger({ type: T.PAYOUT, amount: -5_000n, payoutId: 'p1' }),
    ledger({ type: T.REFUND, amount: -13_950n, bookingId: 'b2' }),
  ];
  const prisma = {
    walletTransaction: { findMany: jest.fn().mockResolvedValue(rows) },
    booking: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'b1', seatsCount: 1, boardingStop: { city: { name: 'Dalaba' } }, alightingStop: null, trip: { originCity: { name: 'Mamou' }, destinationCity: { name: 'Pita' } } },
        { id: 'b2', seatsCount: 2, boardingStop: null, alightingStop: null, trip: { originCity: { name: 'Conakry' }, destinationCity: { name: 'Labé' } } },
      ]),
    },
    shipment: {
      findMany: jest.fn().mockResolvedValue([
        { id: 's1', weightKg: 1, category: { name: 'Documents' }, senderLocation: { label: 'x', city: { name: 'Mamou' } }, recipientLocation: { label: 'y', city: { name: 'Pita' } } },
      ]),
    },
    payout: { findMany: jest.fn().mockResolvedValue([{ id: 'p1', status: 'PAID', method: 'orange_money', destinationRef: '***4417', requestedAt: new Date() }]) },
  };
  const service = new WalletsService(prisma as never, { log: jest.fn() } as never, { notify: jest.fn() } as never, {} as never);
  return { service, prisma };
}

const query = (extra: Record<string, unknown> = {}) => ({ page: 1, limit: 20, skip: 0, take: 20, ...extra }) as never;

describe('WalletsService.getTransactionsForDriverView', () => {
  it('sans filtre : toutes les lignes fusionnées au net (trajet 3 875, envoi 662, retrait, remboursement)', async () => {
    const { service } = build();
    const result = await service.getTransactionsForDriverView('w1', query());
    expect(result.data.map((r) => [r.type, r.amount])).toEqual([
      [T.REFUND, -13_950n],
      [T.PAYOUT, -5_000n],
      [T.SHIPMENT_REVENUE, 662n],
      [T.BOOKING_REVENUE, 3_875n],
    ]);
    expect(result.meta.total).toBe(4);
  });

  it.each([
    ['TRIPS', [T.BOOKING_REVENUE]],
    ['SHIPMENTS', [T.SHIPMENT_REVENUE]],
    ['PAYOUTS', [T.PAYOUT]],
    ['OTHER', [T.REFUND]],
  ])('filtre %s : seulement cette catégorie, et le total de la liste suit', async (category, types) => {
    const { service } = build();
    const result = await service.getTransactionsForDriverView('w1', query({ category }));
    expect(result.data.map((r) => r.type)).toEqual(types);
    expect(result.meta.total).toBe(types.length);
  });

  it('les totaux de TOUTES les catégories sont toujours renvoyés, même avec un filtre', async () => {
    const { service } = build();
    const { summary } = await service.getTransactionsForDriverView('w1', query({ category: 'PAYOUTS' }));
    expect(summary.TRIPS).toEqual({ count: 1, total: '3875', pending: '0' });
    expect(summary.SHIPMENTS).toEqual({ count: 1, total: '662', pending: '0' });
    expect(summary.PAYOUTS).toEqual({ count: 1, total: '-5000', pending: '0' });
    expect(summary.OTHER).toEqual({ count: 1, total: '-13950', pending: '0' });
    expect(summary.ALL.count).toBe(4);
  });

  it('un trajet affiche le tronçon du client, un envoi son itinéraire, un retrait son statut', async () => {
    const { service } = build();
    const { data } = await service.getTransactionsForDriverView('w1', query());
    const by = (type: T) => data.find((r) => r.type === type)?.subject;
    expect(by(T.BOOKING_REVENUE)).toEqual({ kind: 'TRIP', from: 'Dalaba', to: 'Pita', seats: 1 });
    expect(by(T.SHIPMENT_REVENUE)).toEqual({ kind: 'SHIPMENT', from: 'Mamou', to: 'Pita', weightKg: 1, categoryName: 'Documents' });
    expect(by(T.PAYOUT)).toEqual({ kind: 'PAYOUT', status: 'PAID', method: 'orange_money', destination: '***4417' });
    // le remboursement garde le trajet concerné pour qu'on comprenne de quoi il s'agit
    expect(by(T.REFUND)).toMatchObject({ kind: 'TRIP', from: 'Conakry', to: 'Labé' });
  });

  it('jamais d\'information sur le client ni la commission dans ce qui est renvoyé', async () => {
    const { service, prisma } = build();
    const result = await service.getTransactionsForDriverView('w1', query());
    const json = JSON.stringify(result, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(json).not.toMatch(/4456|581|762|customer|phone/i);
    // les requêtes d'enrichissement ne demandent aucune donnée du client
    expect(JSON.stringify(prisma.booking.findMany.mock.calls[0][0])).not.toMatch(/customer|phone|user/i);
  });

  it('pagination : la page demandée seulement, mais total et totaux portent sur tout', async () => {
    const { service, prisma } = build();
    const result = await service.getTransactionsForDriverView('w1', query({ limit: 2, take: 2, skip: 0 }));
    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(4);
    expect(result.summary.ALL.count).toBe(4);
    // l'enrichissement ne charge que les lignes de la page
    expect(prisma.shipment.findMany).not.toHaveBeenCalled();
  });
});
