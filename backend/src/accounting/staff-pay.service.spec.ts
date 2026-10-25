// backend/src/accounting/staff-pay.service.spec.ts
// Fiche de paie du personnel : identité reprise du compte, bulletin calculé, refus clairs, journal sans données sensibles.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StaffPayService } from './staff-pay.service';

const USER = {
  id: 'u1',
  phone: '+224620000001',
  email: 'aissatou@occaz.sarl',
  accountType: 'SUPPORT',
  isActive: true,
  isSuspended: false,
  staffProfile: { firstName: 'Aïssatou', lastName: 'Diallo', address: 'Ratoma, Conakry' },
  userRoles: [{ role: { name: 'Support' } }],
  staffPayProfile: {
    fullName: null,
    employeeNumber: 'EMP-014',
    jobTitle: 'Agent support',
    hireDate: new Date('2025-03-01T00:00:00Z'),
    socialSecurityNumber: '123456789',
    baseSalary: 3_000_000n,
    currencyId: 'gnf',
    currency: { isoCode: 'GNF' },
    allowances: [{ label: 'Transport', amount: '200000' }],
    deductions: [{ label: 'Cotisation', kind: 'PERCENT', value: '500' }],
    updatedAt: new Date(),
  },
};

function build(user: unknown = USER) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user), findMany: jest.fn().mockResolvedValue(user ? [user] : []) },
    currency: { findUnique: jest.fn().mockResolvedValue({ id: 'gnf', isoCode: 'GNF' }) },
    staffPayProfile: { upsert: jest.fn().mockResolvedValue({}) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new StaffPayService(prisma as never, audit as never), prisma, audit };
}

const NOW = new Date('2026-10-25T10:00:00Z');

describe('StaffPayService', () => {
  it("calcule le bulletin et fige l'identité", async () => {
    const { service } = build();
    const result = await service.payslipFor('u1', '2026-09', NOW);
    expect(result.staff).toMatchObject({ fullName: 'Aïssatou Diallo', employeeNumber: 'EMP-014', jobTitle: 'Agent support', hireDate: '2025-03-01', address: 'Ratoma, Conakry' });
    // brut 3 200 000 ; cotisation 5 % = 160 000 ; net 3 040 000
    expect(result.payslip).toMatchObject({ gross: '3200000', totalDeductions: '160000', net: '3040000' });
    expect(result.isoCode).toBe('GNF');
  });

  it("refuse un compte qui n'est pas du personnel, ou sans fiche de paie", async () => {
    await expect(build(null).service.payslipFor('x', '2026-09', NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ ...USER, accountType: 'CUSTOMER' }).service.snapshotOf('u1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(build({ ...USER, staffPayProfile: null }).service.payslipFor('u1', '2026-09', NOW)).rejects.toThrow(/fiche de paie/);
  });

  it('un SuperAdmin sans identité utilise le nom de sa fiche, à défaut son e-mail', async () => {
    const base = { ...USER, accountType: 'SUPERADMIN', staffProfile: null, userRoles: [] };
    const named = build({ ...base, staffPayProfile: { ...USER.staffPayProfile, fullName: 'Thierno Doniko' } });
    expect((await named.service.snapshotOf('u1')).fullName).toBe('Thierno Doniko');
    expect((await named.service.snapshotOf('u1')).roles).toEqual(['SuperAdmin']);
    const anonymous = build({ ...base, staffPayProfile: null });
    expect((await anonymous.service.snapshotOf('u1')).fullName).toBe('aissatou@occaz.sarl');
  });

  it('enregistre la fiche et journalise sans le numéro de sécurité sociale', async () => {
    const { service, prisma, audit } = build();
    await service.upsertPayProfile(
      'u1',
      { baseSalary: '3000000', currencyId: 'gnf', socialSecurityNumber: '999', hireDate: '2025-03-01', allowances: [{ label: 'Transport', amount: '200000' }], deductions: [] } as never,
      'admin1',
    );
    expect(prisma.staffPayProfile.upsert).toHaveBeenCalledTimes(1);
    const diff = JSON.stringify(audit.log.mock.calls[0][0].diff);
    expect(diff).not.toContain('999');
    expect(audit.log.mock.calls[0][0]).toMatchObject({ entityType: 'StaffPayProfile', action: 'UPDATED' });
  });

  it('refuse une fiche dont les retenues dépassent le brut, ou une retenue mal formée', async () => {
    const { service, prisma } = build();
    await expect(
      service.upsertPayProfile('u1', { baseSalary: '1000', currencyId: 'gnf', deductions: [{ label: 'Saisie', kind: 'FIXED', value: '1000' }] } as never, 'admin1'),
    ).rejects.toThrow(/dépassent/);
    await expect(
      service.upsertPayProfile('u1', { baseSalary: '1000', currencyId: 'gnf', deductions: [{ label: 'Impôt', kind: 'PERCENT', value: '20000' }] } as never, 'admin1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.staffPayProfile.upsert).not.toHaveBeenCalled();
  });

  it('la liste indique si la fiche permet de produire un bulletin', async () => {
    const { service } = build();
    const [staff] = await service.listStaff();
    expect(staff).toMatchObject({ userId: 'u1', fullName: 'Aïssatou Diallo', payReady: true });
    expect(staff.pay?.baseSalary).toBe('3000000');
  });
});
