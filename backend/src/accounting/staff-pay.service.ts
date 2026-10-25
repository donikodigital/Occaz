// backend/src/accounting/staff-pay.service.ts
// [25/10/2026] v1 — Personnel de l'administration (SuperAdmin, Support, Superviseur…) et sa fiche de paie : de quoi produire un bulletin.
//
// L'identité (nom, adresse, e-mail, téléphone) vient du compte ; la paie (matricule, emploi, embauche, n° de sécurité sociale, salaire de base,
// primes, retenues) est saisie ici. Quand un retrait « Salaire » ou « Primes » est fait, l'identité ET le bulletin calculé sont FIGÉS dans le
// retrait : changer ensuite la fiche ne modifie jamais une pièce déjà émise.
// Ces données sont sensibles : tous les accès demandent la permission de gérer le portefeuille de la plateforme.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { PayslipLineSnapshot, PayslipSnapshot, StaffSnapshot } from '../platform-wallet/expense-categories';
import { computePayslip, PayDeduction, readAllowances, readDeductions, validatePeriodMonth } from '../platform-wallet/expense-rules';
import { UpsertStaffPayProfileDto } from './dto/staff-pay.dto';

const STAFF_ACCOUNT_TYPES: AccountType[] = [AccountType.SUPERADMIN, AccountType.SUPPORT];

type StaffUser = Prisma.UserGetPayload<{
  include: { staffProfile: true; staffPayProfile: { include: { currency: true } }; userRoles: { include: { role: true } } };
}>;

const STAFF_INCLUDE = {
  staffProfile: true,
  staffPayProfile: { include: { currency: true } },
  userRoles: { include: { role: true } },
} satisfies Prisma.UserInclude;

export interface StaffPaySummary {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string;
  address: string | null;
  roles: string[];
  isActive: boolean;
  /** Faux pour un compte sans identité (SuperAdmin) : le nom du bulletin se saisit alors dans la fiche de paie. */
  hasIdentity: boolean;
  /** Vrai quand la fiche permet de produire un bulletin (salaire de base renseigné). */
  payReady: boolean;
  pay: null | {
    fullName: string | null;
    employeeNumber: string | null;
    jobTitle: string | null;
    hireDate: string | null;
    socialSecurityNumber: string | null;
    baseSalary: string;
    currencyId: string;
    isoCode: string;
    allowances: PayslipLineSnapshot[];
    deductions: PayDeduction[];
    updatedAt: Date;
  };
}

function isoDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function displayName(user: StaffUser): string {
  if (user.staffProfile) return `${user.staffProfile.firstName} ${user.staffProfile.lastName}`.replace(/\s+/g, ' ').trim();
  return user.staffPayProfile?.fullName?.trim() || user.email || user.phone;
}

function roleNames(user: StaffUser): string[] {
  const names = user.userRoles.map((assignment) => assignment.role.name);
  if (names.length === 0 && user.accountType === AccountType.SUPERADMIN) return ['SuperAdmin'];
  return [...new Set(names)];
}

function toSummary(user: StaffUser): StaffPaySummary {
  const pay = user.staffPayProfile;
  return {
    userId: user.id,
    fullName: displayName(user),
    email: user.email,
    phone: user.phone,
    address: user.staffProfile?.address ?? null,
    roles: roleNames(user),
    isActive: user.isActive && !user.isSuspended,
    hasIdentity: !!user.staffProfile,
    payReady: !!pay && pay.baseSalary > 0n,
    pay: pay
      ? {
          fullName: pay.fullName,
          employeeNumber: pay.employeeNumber,
          jobTitle: pay.jobTitle,
          hireDate: isoDate(pay.hireDate),
          socialSecurityNumber: pay.socialSecurityNumber,
          baseSalary: pay.baseSalary.toString(),
          currencyId: pay.currencyId,
          isoCode: pay.currency.isoCode,
          allowances: readAllowances(pay.allowances),
          deductions: readDeductions(pay.deductions),
          updatedAt: pay.updatedAt,
        }
      : null,
  };
}

function toSnapshot(user: StaffUser): StaffSnapshot {
  const pay = user.staffPayProfile;
  return {
    userId: user.id,
    fullName: displayName(user),
    email: user.email,
    phone: user.phone,
    address: user.staffProfile?.address ?? null,
    roles: roleNames(user),
    employeeNumber: pay?.employeeNumber ?? null,
    jobTitle: pay?.jobTitle ?? null,
    hireDate: isoDate(pay?.hireDate ?? null),
    socialSecurityNumber: pay?.socialSecurityNumber ?? null,
  };
}

@Injectable()
export class StaffPayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Tout le personnel de l'administration (comptes actifs ou non : un ancien salarié garde ses pièces), les actifs d'abord. */
  async listStaff(): Promise<StaffPaySummary[]> {
    const users = await this.prisma.user.findMany({
      where: { accountType: { in: STAFF_ACCOUNT_TYPES } },
      include: STAFF_INCLUDE,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      take: 300,
    });
    return users.map(toSummary).sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName, 'fr'));
  }

  private async loadStaff(userId: string): Promise<StaffUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: STAFF_INCLUDE });
    if (!user || !STAFF_ACCOUNT_TYPES.includes(user.accountType)) {
      throw new NotFoundException("Cette personne ne fait pas partie du personnel de l'administration.");
    }
    return user;
  }

  /** Identité figée d'un membre du personnel (primes, salaires). */
  async snapshotOf(userId: string): Promise<StaffSnapshot> {
    return toSnapshot(await this.loadStaff(userId));
  }

  /**
   * Bulletin du mois : identité + calcul figés. Refuse si la fiche de paie n'est pas renseignée, ou si le salaire est dans une autre devise
   * que celle du retrait.
   */
  async payslipFor(userId: string, period: string, now: Date = new Date()): Promise<{ staff: StaffSnapshot; payslip: PayslipSnapshot; currencyId: string; isoCode: string }> {
    const month = validatePeriodMonth(period, now);
    const user = await this.loadStaff(userId);
    const pay = user.staffPayProfile;
    if (!pay) {
      throw new BadRequestException(`${displayName(user)} n'a pas encore de fiche de paie : renseigne-la dans Comptabilité › Personnel.`);
    }
    const payslip = computePayslip({
      period: month,
      baseSalary: pay.baseSalary,
      allowances: readAllowances(pay.allowances),
      deductions: readDeductions(pay.deductions),
    });
    return { staff: toSnapshot(user), payslip, currencyId: pay.currencyId, isoCode: pay.currency.isoCode };
  }

  async upsertPayProfile(userId: string, dto: UpsertStaffPayProfileDto, actorId: string): Promise<StaffPaySummary> {
    const user = await this.loadStaff(userId);
    const currency = await this.prisma.currency.findUnique({ where: { id: dto.currencyId } });
    if (!currency) throw new NotFoundException('Devise introuvable.');

    // « strict » : une ligne invalide est refusée avec un message clair au lieu d'être ignorée en silence.
    const allowances = readAllowances(dto.allowances ?? [], true);
    const deductions = readDeductions(dto.deductions ?? [], true);
    // Le net doit rester positif : on vérifie tout de suite plutôt qu'au premier bulletin.
    computePayslip({ period: '2020-01', baseSalary: BigInt(dto.baseSalary), allowances, deductions });

    const hireDate = dto.hireDate ? new Date(`${dto.hireDate}T00:00:00.000Z`) : null;
    if (hireDate && Number.isNaN(hireDate.getTime())) throw new BadRequestException("La date d'embauche n'est pas valide.");

    const text = (value: string | undefined) => value?.replace(/\s+/g, ' ').trim() || null;
    const data = {
      fullName: text(dto.fullName),
      employeeNumber: text(dto.employeeNumber),
      jobTitle: text(dto.jobTitle),
      hireDate,
      socialSecurityNumber: text(dto.socialSecurityNumber),
      baseSalary: BigInt(dto.baseSalary),
      currencyId: currency.id,
      allowances: allowances as unknown as Prisma.InputJsonValue,
      deductions: deductions as unknown as Prisma.InputJsonValue,
    };
    const existed = !!user.staffPayProfile;
    await this.prisma.staffPayProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });

    // Le journal garde ce qui a changé de façon lisible, sans le n° de sécurité sociale.
    await this.audit.log({
      actorId,
      entityType: 'StaffPayProfile',
      entityId: userId,
      action: existed ? 'UPDATED' : 'CREATED',
      diff: {
        baseSalary: dto.baseSalary,
        currency: currency.isoCode,
        allowances: allowances.length,
        deductions: deductions.length,
      },
    });
    return toSummary(await this.loadStaff(userId));
  }
}
