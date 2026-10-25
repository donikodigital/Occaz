// backend/src/accounting/accounting-export.service.spec.ts
import ExcelJS from 'exceljs';
import { AccountingExportService } from './accounting-export.service';
import { AccountingService } from './accounting.service';

async function build() {
  const prisma = {
    currency: { findMany: jest.fn().mockResolvedValue([{ id: 'gnf', isoCode: 'GNF' }]) },
    $queryRaw: jest.fn().mockImplementation((strings: string[]) => {
      const sql = strings.join('?');
      if (sql.includes('"wallet_transactions"')) return Promise.resolve([{ currencyId: 'gnf', month: 2, total: 1_000_000n }]);
      if (sql.includes('"payouts"')) return Promise.resolve([{ currencyId: 'gnf', month: 2, total: 700_000n, count: 3 }]);
      return Promise.resolve([{ currencyId: 'gnf', category: 'SUPPLIES', month: 2, total: 250_000n, count: 1 }]);
    }),
    walletTransaction: { aggregate: jest.fn().mockResolvedValue({ _min: { createdAt: new Date('2026-01-01T00:00:00Z') } }) },
    platformWithdrawal: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'w1',
          documentNumber: 'FAC-2026-000001',
          processedAt: new Date('2026-02-10T10:00:00Z'),
          requestedAt: new Date('2026-02-09T10:00:00Z'),
          category: 'SUPPLIES',
          categoryLabel: null,
          note: null,
          amount: 250_000n,
          externalReference: 'OM-1',
          details: { supplier: { name: 'Papeterie Moderne' } },
          currency: { isoCode: 'GNF' },
          beneficiary: { label: 'Mon Orange Money' },
        },
      ]),
    },
  };
  return new AccountingExportService(new AccountingService(prisma as never));
}

describe('AccountingExportService', () => {
  it('Excel : une synthèse par devise (formules de totaux) et la liste des dépenses payées', async () => {
    const service = await build();
    const buffer = await service.excel(2026, true);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Synthèse GNF', 'Dépenses payées']);
    const summary = workbook.getWorksheet('Synthèse GNF')!;
    expect(summary.getCell('A6').value).toBe('Février');
    expect(summary.getCell('B6').value).toBe(1_000_000);
    // 1er semestre = SOMME des 6 premiers mois ; année = SOMME des 12 mois ; résultat = commissions − dépenses.
    expect((summary.getCell('B18').value as { formula: string }).formula).toBe('SUM(B5:B10)');
    expect((summary.getCell('B20').value as { formula: string }).formula).toBe('SUM(B5:B16)');
    expect((summary.getCell('M6').value as { formula: string }).formula).toBe('B6-E6');
    expect((summary.getCell('M6').value as { result: number }).result).toBe(750_000);

    const expenses = workbook.getWorksheet('Dépenses payées')!;
    expect(expenses.getCell('B4').value).toBe('FAC-2026-000001');
    expect(expenses.getCell('G4').value).toBe(250_000);
  });

  it('PDF : un document valide', async () => {
    const service = await build();
    const pdf = await service.pdf(2026);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1500);
  });
});
