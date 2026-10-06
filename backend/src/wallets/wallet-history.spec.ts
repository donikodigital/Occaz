// backend/src/wallets/wallet-history.spec.ts
import { WalletTransactionStatus as S, WalletTransactionType as T } from '@prisma/client';
import { LedgerRow, categoryOf, filterByCategory, mergeForDriver, summarize } from './wallet-history';

let seq = 0;
const row = (over: Partial<LedgerRow> & Pick<LedgerRow, 'type' | 'amount'>): LedgerRow => ({
  id: `r${++seq}`,
  status: S.COMPLETED,
  currencyId: 'xof',
  bookingId: null,
  shipmentId: null,
  payoutId: null,
  createdAt: new Date(Date.UTC(2026, 9, 4, 12, seq)),
  ...over,
});

/** Un trajet : revenu brut (payé par le client, commission comprise) + commission négative → net 3 875 pour le conducteur. */
const trip = (id: string, status: S = S.COMPLETED, metadata?: unknown): LedgerRow[] => [
  row({ type: T.BOOKING_REVENUE, amount: 4_456n, bookingId: id, status, metadata }),
  row({ type: T.COMMISSION, amount: -581n, bookingId: id, status }),
];
const shipment = (id: string, amount = 662n): LedgerRow[] => [
  row({ type: T.SHIPMENT_REVENUE, amount: amount + 100n, shipmentId: id }),
  row({ type: T.COMMISSION, amount: -100n, shipmentId: id }),
];

describe('mergeForDriver — le conducteur ne voit que sa part', () => {
  it('fusionne revenu et commission en une ligne au montant net', () => {
    const merged = mergeForDriver(trip('b1'));
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 'net:b1', type: T.BOOKING_REVENUE, amount: 3_875n, category: 'TRIPS' });
  });

  it('une ligne par réservation et par envoi, les autres lignes passent telles quelles, du plus récent au plus ancien', () => {
    // Créés dans cet ordre : trajet, envoi, retrait, remboursement (chacun plus récent que le précédent)
    const tripRows = trip('b1');
    const shipmentRows = shipment('s1');
    const payout = row({ type: T.PAYOUT, amount: -5_000n, payoutId: 'p1' });
    const refund = row({ type: T.REFUND, amount: -13_950n, bookingId: 'b9' });
    const merged = mergeForDriver([...tripRows, ...shipmentRows, payout, refund]);
    expect(merged.map((m) => m.type)).toEqual([T.REFUND, T.PAYOUT, T.SHIPMENT_REVENUE, T.BOOKING_REVENUE]);
    expect(merged.find((m) => m.type === T.SHIPMENT_REVENUE)?.amount).toBe(662n);
  });

  it('statut unique : celui de la ligne la plus récente du couple', () => {
    expect(mergeForDriver(trip('b1', S.PENDING))[0].status).toBe(S.PENDING);
  });

  it('la conversion de devise n\'expose que les devises et le taux, jamais les montants (brut du client, commission)', () => {
    const metadata = {
      conversion: { fromIsoCode: 'GNF', toIsoCode: 'XOF', rate: 0.062, fromAmount: '71875', toAmount: '4456', fromCurrencyId: 'g', toCurrencyId: 'x', convertedAt: 'now' },
    };
    const [merged] = mergeForDriver(trip('b1', S.COMPLETED, metadata));
    expect(merged.conversion).toEqual({ fromIsoCode: 'GNF', toIsoCode: 'XOF', rate: 0.062 });
    expect(JSON.stringify(merged, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('71875');
  });

  it('pas de conversion enregistrée : conversion = null', () => {
    expect(mergeForDriver(trip('b1'))[0].conversion).toBeNull();
  });
});

describe('categoryOf', () => {
  it.each([
    [T.BOOKING_REVENUE, 'TRIPS'],
    [T.SHIPMENT_REVENUE, 'SHIPMENTS'],
    [T.PAYOUT, 'PAYOUTS'],
    [T.REFUND, 'OTHER'],
    [T.ADJUSTMENT, 'OTHER'],
    [T.CANCELLATION_FEE, 'OTHER'],
    [T.COMMISSION, 'OTHER'],
  ])('%s → %s', (type, category) => {
    expect(categoryOf(type)).toBe(category);
  });
});

describe('summarize — totaux par catégorie', () => {
  const history = () =>
    mergeForDriver([
      ...trip('b1'),
      ...trip('b2'),
      ...trip('b3', S.PENDING),
      ...trip('b4', S.REVERSED),
      ...shipment('s1', 662n),
      row({ type: T.PAYOUT, amount: -5_000n, payoutId: 'p1' }),
      row({ type: T.PAYOUT, amount: -2_000n, payoutId: 'p2', status: S.PENDING }),
      row({ type: T.REFUND, amount: -13_950n, bookingId: 'b9' }),
    ]);

  it('trajets : somme des opérations payées, les « en cours » à part, les annulées exclues des sommes', () => {
    const { TRIPS } = summarize(history());
    expect(TRIPS.total).toBe(7_750n); // 2 × 3 875
    expect(TRIPS.pending).toBe(3_875n);
    expect(TRIPS.count).toBe(4); // les 4 lignes de la liste, annulée comprise
  });

  it('envois, retraits et autres', () => {
    const summary = summarize(history());
    expect(summary.SHIPMENTS.total).toBe(662n);
    expect(summary.PAYOUTS.total).toBe(-5_000n);
    expect(summary.PAYOUTS.pending).toBe(-2_000n);
    expect(summary.OTHER.total).toBe(-13_950n);
  });

  it('ALL : somme de tout ce qui est payé (= le solde disponible quand tout l\'historique est là)', () => {
    const summary = summarize(history());
    expect(summary.ALL.total).toBe(7_750n + 662n - 5_000n - 13_950n);
    expect(summary.ALL.count).toBe(8);
  });

  it('historique vide : tout à zéro', () => {
    expect(summarize([]).ALL).toEqual({ count: 0, total: 0n, pending: 0n });
  });
});

describe('filterByCategory', () => {
  it('ne garde que la catégorie demandée ; ALL garde tout', () => {
    const history = mergeForDriver([...trip('b1'), ...shipment('s1'), row({ type: T.PAYOUT, amount: -5_000n, payoutId: 'p1' })]);
    expect(filterByCategory(history, 'TRIPS')).toHaveLength(1);
    expect(filterByCategory(history, 'PAYOUTS')[0].type).toBe(T.PAYOUT);
    expect(filterByCategory(history, 'ALL')).toHaveLength(3);
  });
});
