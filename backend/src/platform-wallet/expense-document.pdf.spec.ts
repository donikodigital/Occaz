// backend/src/platform-wallet/expense-document.pdf.spec.ts
// [25/10/2026] v1 — Bulletin de salaire : ancienneté et rendu PDF (une page, plusieurs pages, champs vides).
import { ExpenseDocumentData, renderExpenseDocument, seniorityText } from './expense-document.pdf';
import { computePayslip } from './expense-rules';
import { BRAND_LOGO_PNG } from './brand-logo';

describe('seniorityText', () => {
  it('compte les mois révolus à la fin de la période', () => {
    expect(seniorityText('2025-03-01', '2026-09')).toBe('1 an 7 mois');
    expect(seniorityText('2025-03-15', '2026-09')).toBe('1 an 6 mois');
    expect(seniorityText('2024-09-01', '2026-08')).toBe('2 ans');
    expect(seniorityText('2026-09-01', '2026-09')).toBe('1 mois');
    expect(seniorityText('2026-09-15', '2026-09')).toBe("moins d'un mois");
  });

  it("renvoie null quand l'embauche est inconnue, illisible ou postérieure", () => {
    expect(seniorityText(null, '2026-09')).toBeNull();
    expect(seniorityText('mars 2025', '2026-09')).toBeNull();
    expect(seniorityText('2026-11-01', '2026-09')).toBeNull();
  });
});

describe('bulletin de salaire PDF', () => {
  const base = {
    issuedAt: new Date('2026-10-25T10:00:00Z'),
    timeZone: 'Africa/Conakry',
    company: { name: "Occa'Z SARL", address: 'Kaloum, Conakry' },
    isoCode: 'GNF',
    status: 'PAID',
    processedAt: new Date('2026-10-25T12:00:00Z'),
    beneficiaryName: 'Aïssatou Diallo',
    beneficiaryPhoneMasked: '****4417',
    paymentMethod: 'orange_money',
    paymentRef: null,
    issuedBy: null,
    category: 'SALARY',
    categoryText: 'Salaire',
    documentNumber: 'BUL-2026-000001',
    periodMonth: '2026-09',
  } as const;
  const staff = {
    userId: 'u1',
    fullName: 'Aïssatou Diallo',
    email: null,
    phone: '+224620000001',
    address: null,
    roles: ['Support'],
    employeeNumber: null,
    jobTitle: null,
    hireDate: null,
    socialSecurityNumber: null,
  };

  const render = (slip: ReturnType<typeof computePayslip>, extra: Partial<ExpenseDocumentData> = {}) =>
    renderExpenseDocument({ ...base, amount: BigInt(slip.net), details: { staff, payslip: slip }, ...extra } as ExpenseDocumentData);
  const pages = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;

  it('le logo embarqué est un PNG valide', () => {
    expect(BRAND_LOGO_PNG.subarray(1, 4).toString()).toBe('PNG');
  });

  it('rend un bulletin simple sur une page, même sans identité complète ni retenues', async () => {
    const withDeductions = computePayslip({
      period: '2026-09',
      baseSalary: 3_000_000n,
      allowances: [{ label: 'Prime de transport', amount: '200000' }],
      deductions: [{ label: 'Cotisation sociale', kind: 'PERCENT', value: '500' }],
    });
    const pdf = await render(withDeductions, { yearToDate: { gross: 9n * 3_200_000n, deductions: 9n * 160_000n, net: 9n * 3_040_000n } });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pages(pdf)).toBe(1);

    const bare = computePayslip({ period: '2026-09', baseSalary: 1_000_000n, allowances: [], deductions: [] });
    expect(pages(await render(bare, { status: 'PROCESSING', processedAt: null }))).toBe(1);
  });

  it('continue sur une deuxième page quand les rubriques sont nombreuses', async () => {
    const slip = computePayslip({
      period: '2026-09',
      baseSalary: 9_000_000n,
      allowances: Array.from({ length: 30 }, (_, i) => ({ label: `Indemnité ${i + 1}`, amount: '10000' })),
      deductions: [],
    });
    expect(pages(await render(slip))).toBe(2);
  });
});