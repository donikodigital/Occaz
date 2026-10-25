// backend/src/accounting/accounting.service.spec.ts
// Synthèse comptable : regroupement par mois / semestre / année, devise par devise, résultat = commissions − dépenses payées.
import { AccountingService } from './accounting.service';

function build(rows: { commissions?: unknown[]; payouts?: unknown[]; expenses?: unknown[]; withdrawals?: unknown[] } = {}) {
  const prisma = {
    currency: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'gnf', isoCode: 'GNF' },
        { id: 'xof', isoCode: 'XOF' },
      ]),
    },
    $queryRaw: jest.fn().mockImplementation((strings: string[]) => {
      const sql = strings.join('?');
      if (sql.includes('"wallet_transactions"')) return Promise.resolve(rows.commissions ?? []);
      if (sql.includes('"payouts"')) return Promise.resolve(rows.payouts ?? []);
      if (sql.includes('"platform_withdrawals"')) return Promise.resolve(rows.expenses ?? []);
      return Promise.resolve([]);
    }),
    walletTransaction: { aggregate: jest.fn().mockResolvedValue({ _min: { createdAt: new Date('2025-06-01T00:00:00Z') } }) },
    platformWithdrawal: { findMany: jest.fn().mockResolvedValue(rows.withdrawals ?? []) },
  };
  return { service: new AccountingService(prisma as never), prisma };
}

describe('AccountingService.summary', () => {
  const rows = {
    commissions: [
      { currencyId: 'gnf', month: 1, total: 1_000_000n },
      { currencyId: 'gnf', month: 7, total: 500_000n },
      { currencyId: 'xof', month: 3, total: 40_000n },
    ],
    payouts: [
      { currencyId: 'gnf', month: 1, total: 8_000_000n, count: 4 },
      { currencyId: 'gnf', month: 8, total: 2_000_000n, count: 1 },
    ],
    expenses: [
      { currencyId: 'gnf', category: 'SALARY', month: 1, total: 300_000n, count: 1 },
      { currencyId: 'gnf', category: 'SUPPLIES', month: 7, total: 100_000n, count: 2 },
    ],
  };

  it('regroupe par mois, semestre et année, par devise', async () => {
    const { service } = build(rows);
    const summary = await service.summary(2026);
    const gnf = summary.currencies.find((c) => c.isoCode === 'GNF')!;
    const xof = summary.currencies.find((c) => c.isoCode === 'XOF')!;

    expect(gnf.months).toHaveLength(12);
    expect(gnf.months[0]).toMatchObject({ label: 'Janvier', commissions: '1000000', driverPayouts: '8000000', driverPayoutCount: 4, adminExpenses: '300000', result: '700000' });
    expect(gnf.semesters[0]).toMatchObject({ label: '1er semestre', commissions: '1000000', driverPayouts: '8000000', adminExpenses: '300000' });
    expect(gnf.semesters[1]).toMatchObject({ commissions: '500000', driverPayouts: '2000000', adminExpenses: '100000', result: '400000' });
    expect(gnf.year).toMatchObject({ commissions: '1500000', driverPayouts: '10000000', driverPayoutCount: 5, adminExpenses: '400000', adminExpenseCount: 3, result: '1100000' });
    expect(gnf.year.byCategory).toMatchObject({ SALARY: '300000', SUPPLIES: '100000', BONUS: '0' });
    // Les devises ne se mélangent jamais.
    expect(xof.year).toMatchObject({ commissions: '40000', driverPayouts: '0', adminExpenses: '0' });
  });

  it('le résultat peut être négatif', async () => {
    const { service } = build({ expenses: [{ currencyId: 'gnf', category: 'OPERATING', month: 2, total: 90n, count: 1 }] });
    const gnf = (await service.summary(2026)).currencies.find((c) => c.isoCode === 'GNF')!;
    expect(gnf.months[1].result).toBe('-90');
  });

  it('toutes les devises apparaissent, même sans mouvement', async () => {
    const { service } = build();
    const summary = await service.summary(2026);
    expect(summary.currencies.map((c) => c.isoCode)).toEqual(['GNF', 'XOF']);
    expect(summary.currencies[0].year.result).toBe('0');
  });

  it("propose les années depuis la première commission jusqu'à l'année en cours", async () => {
    const { service } = build();
    const summary = await service.summary(2026);
    expect(summary.years).toContain(2026);
    expect(summary.years).toContain(2025);
    expect(summary.years).not.toContain(2024);
  });
});

describe('AccountingService.paidExpenses', () => {
  const withdrawal = (category: string, details: unknown) => ({
    id: `w-${category}`,
    documentNumber: 'X-1',
    processedAt: new Date('2026-03-10T10:00:00Z'),
    requestedAt: new Date('2026-03-09T10:00:00Z'),
    category,
    categoryLabel: null,
    note: null,
    amount: 250_000n,
    externalReference: 'OM-1',
    details,
    currency: { isoCode: 'GNF' },
    beneficiary: { label: 'Mon Orange Money' },
  });
  const rows = [
    withdrawal('SALARY', { staff: { fullName: 'Aïssatou Diallo' } }),
    withdrawal('SUPPLIES', { supplier: { name: 'Papeterie Moderne' } }),
  ];

  it('masque les noms du personnel pour ceux qui ne gèrent pas le portefeuille', async () => {
    const { service } = build({ withdrawals: rows });
    const hidden = await service.paidExpenses(2026, false);
    expect(hidden[0].subject).toBe('Personnel');
    expect(hidden[1].subject).toBe('Papeterie Moderne');
    const shown = await service.paidExpenses(2026, true);
    expect(shown[0].subject).toBe('Aïssatou Diallo');
  });
});
