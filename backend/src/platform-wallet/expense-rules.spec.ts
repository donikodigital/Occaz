// backend/src/platform-wallet/expense-rules.spec.ts
import { BadRequestException } from '@nestjs/common';
import { buildLines, computePayslip, readAllowances, readDeductions, validateExpenseInput, validatePeriodMonth } from './expense-rules';

const NOW = new Date('2026-10-25T10:00:00Z');

describe('validatePeriodMonth', () => {
  it('accepte le mois courant et les mois passés', () => {
    expect(validatePeriodMonth('2026-10', NOW)).toBe('2026-10');
    expect(validatePeriodMonth('2026-01', NOW)).toBe('2026-01');
  });
  it('refuse le futur et les formats invalides', () => {
    expect(() => validatePeriodMonth('2026-11', NOW)).toThrow(BadRequestException);
    expect(() => validatePeriodMonth('2026-13', NOW)).toThrow(BadRequestException);
    expect(() => validatePeriodMonth('octobre', NOW)).toThrow(BadRequestException);
    expect(() => validatePeriodMonth(undefined, NOW)).toThrow(BadRequestException);
  });
});

describe('buildLines', () => {
  it('calcule les totaux en BigInt', () => {
    const result = buildLines(
      [
        { description: 'Ramettes de papier A4', quantity: 10, unitPrice: '45000' },
        { description: 'Stylos', quantity: 3, unitPrice: '2500' },
      ],
      true,
    );
    expect(result.total).toBe(457_500n);
    expect(result.lines[0].total).toBe('450000');
  });
  it('exige au moins une ligne quand elles sont obligatoires', () => {
    expect(() => buildLines([], true)).toThrow(BadRequestException);
    expect(buildLines(undefined, false).total).toBe(0n);
  });
  it('refuse quantité ou prix invalides', () => {
    expect(() => buildLines([{ description: 'Café', quantity: 0, unitPrice: '100' }], true)).toThrow(/quantité/);
    expect(() => buildLines([{ description: 'Café', quantity: 1.5, unitPrice: '100' }], true)).toThrow(/quantité/);
    expect(() => buildLines([{ description: 'Café', quantity: 1, unitPrice: '-5' }], true)).toThrow(/prix unitaire/);
    expect(() => buildLines([{ description: 'Café', quantity: 1, unitPrice: '12.5' }], true)).toThrow(/prix unitaire/);
    expect(() => buildLines([{ description: 'C', quantity: 1, unitPrice: '100' }], true)).toThrow(/désignation/);
  });
});

describe('validateExpenseInput', () => {
  it('Fournitures : fournisseur + lignes obligatoires, le montant vient des lignes', () => {
    const result = validateExpenseInput(
      {
        category: 'SUPPLIES',
        supplier: { name: '  Papeterie  Moderne ', invoiceRef: 'F-12' },
        lines: [{ description: 'Papier A4', quantity: 5, unitPrice: '40000' }],
      },
      NOW,
    );
    expect(result.amountFromLines).toBe(200_000n);
    expect(result.details.supplier?.name).toBe('Papeterie Moderne');
    expect(() => validateExpenseInput({ category: 'SUPPLIES', lines: [{ description: 'Papier', quantity: 1, unitPrice: '1' }] }, NOW)).toThrow(/fournisseur/);
    expect(() => validateExpenseInput({ category: 'OFFICE_EQUIPMENT', supplier: { name: 'Info Plus' } }, NOW)).toThrow(/ligne/);
  });

  it('Salaire : personne + mois obligatoires, aucun montant à saisir', () => {
    const ok = validateExpenseInput({ category: 'SALARY', staffUserId: 'u1', periodMonth: '2026-09' }, NOW);
    expect(ok.staffUserId).toBe('u1');
    expect(ok.periodMonth).toBe('2026-09');
    expect(ok.amountFromLines).toBeNull();
    expect(() => validateExpenseInput({ category: 'SALARY', periodMonth: '2026-09' }, NOW)).toThrow(/personne/);
    expect(() => validateExpenseInput({ category: 'SALARY', staffUserId: 'u1' }, NOW)).toThrow(/mois/);
  });

  it('Prime : personne + raison', () => {
    expect(() => validateExpenseInput({ category: 'BONUS', staffUserId: 'u1' }, NOW)).toThrow(/raison/);
    expect(validateExpenseInput({ category: 'BONUS', staffUserId: 'u1', reason: 'Objectifs atteints' }, NOW).details.reason).toBe('Objectifs atteints');
  });

  it('Autres : libellé saisi + objet', () => {
    expect(() => validateExpenseInput({ category: 'OTHER', reason: 'Réception' }, NOW)).toThrow(/motif/);
    const ok = validateExpenseInput({ category: 'OTHER', categoryLabel: ' Frais de réception ', reason: 'Visite des partenaires' }, NOW);
    expect(ok.categoryLabel).toBe('Frais de réception');
  });

  it('Voyage : trajet obligatoire, lignes facultatives qui fixent alors le montant', () => {
    expect(() => validateExpenseInput({ category: 'TRAVEL' }, NOW)).toThrow(/voyage/);
    const base = { traveler: 'Mamadou Diallo', from: 'Conakry', to: 'Labé', purpose: 'Visite des conducteurs' };
    expect(validateExpenseInput({ category: 'TRAVEL', travel: base }, NOW).amountFromLines).toBeNull();
    const detailed = validateExpenseInput({ category: 'TRAVEL', travel: base, lines: [{ description: 'Transport', quantity: 2, unitPrice: '150000' }] }, NOW);
    expect(detailed.amountFromLines).toBe(300_000n);
  });

  it('Fonctionnement : objet obligatoire', () => {
    expect(() => validateExpenseInput({ category: 'OPERATING' }, NOW)).toThrow(/objet/);
  });
});

describe('fiche de paie', () => {
  it('lit les primes et retenues en ignorant les lignes invalides', () => {
    expect(readAllowances([{ label: 'Transport', amount: '150000' }, { label: '', amount: '1' }, { label: 'X', amount: -4 }, 'bizarre'])).toEqual([
      { label: 'Transport', amount: '150000' },
    ]);
    expect(readDeductions([{ label: 'Cotisation', kind: 'PERCENT', value: '500' }, { label: 'Mauvais', kind: 'PERCENT', value: '20000' }, null])).toEqual([
      { label: 'Cotisation', kind: 'PERCENT', value: '500' },
    ]);
  });

  it('refuse en mode strict', () => {
    expect(() => readAllowances([{ label: 'Transport', amount: 'abc' }], true)).toThrow(BadRequestException);
    expect(() => readDeductions([{ label: 'Impôt', kind: 'PERCENT', value: '10001' }], true)).toThrow(BadRequestException);
    expect(() => readDeductions([{ label: 'Impôt', kind: 'FIXED', value: '0' }], true)).toThrow(BadRequestException);
  });

  it('calcule brut, retenues et net', () => {
    const payslip = computePayslip({
      period: '2026-09',
      baseSalary: 3_000_000n,
      allowances: [{ label: 'Transport', amount: '200000' }],
      deductions: [
        { label: 'Cotisation sociale', kind: 'PERCENT', value: '500' }, // 5 % de 3 200 000 = 160 000
        { label: 'Avance', kind: 'FIXED', value: '50000' },
      ],
    });
    expect(payslip.gross).toBe('3200000');
    expect(payslip.deductions.map((d) => d.amount)).toEqual(['160000', '50000']);
    expect(payslip.totalDeductions).toBe('210000');
    expect(payslip.net).toBe('2990000');
  });

  it("arrondit la retenue en pourcentage à l'unité la plus proche (demi vers le haut)", () => {
    const payslip = computePayslip({ period: '2026-09', baseSalary: 1_001n, allowances: [], deductions: [{ label: 'Taxe', kind: 'PERCENT', value: '50' }] });
    // 0,5 % de 1 001 = 5,005 → 5
    expect(payslip.deductions[0].amount).toBe('5');
    const half = computePayslip({ period: '2026-09', baseSalary: 1_100n, allowances: [], deductions: [{ label: 'Taxe', kind: 'PERCENT', value: '50' }] });
    // 0,5 % de 1 100 = 5,5 → 6
    expect(half.deductions[0].amount).toBe('6');
  });

  it('refuse un salaire de base nul ou un net négatif', () => {
    expect(() => computePayslip({ period: '2026-09', baseSalary: 0n, allowances: [], deductions: [] })).toThrow(/salaire de base/);
    expect(() =>
      computePayslip({ period: '2026-09', baseSalary: 100n, allowances: [], deductions: [{ label: 'Saisie', kind: 'FIXED', value: '100' }] }),
    ).toThrow(/dépassent/);
  });
});
