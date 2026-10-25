// backend/src/accounting/accounting.service.ts
// [25/10/2026] v1 — Comptabilité de la plateforme : pour une année et par devise (jamais de mélange GNF / XOF), les montants MENSUELS,
// SEMESTRIELS et ANNUELS de :
//   • Commissions (ce que la plateforme encaisse)        — commissions libérées (COMPLETED), dans la devise payée par le client ;
//                                                          daté du jour d'inscription au registre (le registre ne garde pas de date de libération)
//   • Versé aux conducteurs                              — retraits de conducteurs PAYÉS, datés du jour du paiement
//   • Dépenses de l'administration                       — retraits de la plateforme PAYÉS, par motif, datés du jour du paiement
//   • Résultat = commissions − dépenses de l'administration
// Les retraits « en cours » ne sont pas comptés tant qu'ils ne sont pas payés (base « encaissements / décaissements »).
import { Injectable } from '@nestjs/common';
import { ExpenseCategory, PlatformWithdrawalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EXPENSE_CATEGORY_ORDER, expenseCategoryText, type StoredExpenseDetails } from '../platform-wallet/expense-categories';

export const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export interface AccountingBucket {
  label: string;
  commissions: string;
  driverPayouts: string;
  driverPayoutCount: number;
  adminExpenses: string;
  adminExpenseCount: number;
  /** Dépenses de l'administration par motif (tous les motifs, même à 0). */
  byCategory: Record<ExpenseCategory, string>;
  /** Commissions − dépenses de l'administration (peut être négatif). */
  result: string;
}

export interface CurrencyAccounting {
  currencyId: string;
  isoCode: string;
  months: AccountingBucket[];
  semesters: AccountingBucket[];
  year: AccountingBucket;
}

export interface AccountingSummary {
  year: number;
  generatedAt: string;
  years: number[];
  currencies: CurrencyAccounting[];
}

export interface PaidExpenseRow {
  id: string;
  documentNumber: string | null;
  paidAt: string;
  category: ExpenseCategory;
  motif: string;
  subject: string | null;
  beneficiary: string;
  isoCode: string;
  amount: string;
  externalReference: string | null;
}

interface Accumulator {
  commissions: bigint[];
  payouts: bigint[];
  payoutCount: number[];
  expenses: bigint[];
  expenseCount: number[];
  byCategory: Record<ExpenseCategory, bigint[]>;
}

const zeros = <T>(value: T) => Array.from({ length: 12 }, () => value);

function emptyAccumulator(): Accumulator {
  const byCategory = {} as Record<ExpenseCategory, bigint[]>;
  for (const category of EXPENSE_CATEGORY_ORDER) byCategory[category] = zeros(0n);
  return { commissions: zeros(0n), payouts: zeros(0n), payoutCount: zeros(0), expenses: zeros(0n), expenseCount: zeros(0), byCategory };
}

const sum = (values: bigint[], from: number, to: number) => values.slice(from, to).reduce((total, value) => total + value, 0n);
const count = (values: number[], from: number, to: number) => values.slice(from, to).reduce((total, value) => total + value, 0);

/** Regroupe les mois [from, to[ (0 = janvier) en un seul total. */
function bucket(acc: Accumulator, label: string, from: number, to: number): AccountingBucket {
  const commissions = sum(acc.commissions, from, to);
  const adminExpenses = sum(acc.expenses, from, to);
  const byCategory = {} as Record<ExpenseCategory, string>;
  for (const category of EXPENSE_CATEGORY_ORDER) byCategory[category] = sum(acc.byCategory[category], from, to).toString();
  return {
    label,
    commissions: commissions.toString(),
    driverPayouts: sum(acc.payouts, from, to).toString(),
    driverPayoutCount: count(acc.payoutCount, from, to),
    adminExpenses: adminExpenses.toString(),
    adminExpenseCount: count(acc.expenseCount, from, to),
    byCategory,
    result: (commissions - adminExpenses).toString(),
  };
}

/** Fenêtre d'une année civile en UTC (Conakry est à UTC+0). */
export function yearWindow(year: number): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
}

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(yearInput?: number): Promise<AccountingSummary> {
    const year = yearInput ?? new Date().getUTCFullYear();
    const { start, end } = yearWindow(year);

    const [currencies, commissionRows, payoutRows, expenseRows, firstTransaction] = await Promise.all([
      this.prisma.currency.findMany({ orderBy: { isoCode: 'asc' } }),
      // Montant et devise d'origine de la réservation / de l'envoi (voir PlatformWalletService.computeBalance), pas la valeur convertie du registre.
      this.prisma.$queryRaw<{ currencyId: string; month: number; total: bigint | null }[]>`
        SELECT src."currencyId" AS "currencyId",
               EXTRACT(MONTH FROM wt."createdAt")::int AS "month",
               SUM(src."platformFee")::bigint AS "total"
        FROM "wallet_transactions" wt
        JOIN (
          SELECT "id", "currencyId", "platformFee" FROM "bookings"
          UNION ALL
          SELECT "id", "currencyId", "platformFee" FROM "shipments"
        ) src ON src."id" = COALESCE(wt."bookingId", wt."shipmentId")
        WHERE wt."type" = 'COMMISSION'
          AND wt."status" = 'COMPLETED'
          AND wt."createdAt" >= ${start} AND wt."createdAt" < ${end}
        GROUP BY src."currencyId", EXTRACT(MONTH FROM wt."createdAt")
      `,
      this.prisma.$queryRaw<{ currencyId: string; month: number; total: bigint | null; count: number }[]>`
        SELECT p."currencyId" AS "currencyId",
               EXTRACT(MONTH FROM p."processedAt")::int AS "month",
               SUM(p."amount")::bigint AS "total",
               COUNT(*)::int AS "count"
        FROM "payouts" p
        WHERE p."status" = 'PAID'
          AND p."processedAt" >= ${start} AND p."processedAt" < ${end}
        GROUP BY p."currencyId", EXTRACT(MONTH FROM p."processedAt")
      `,
      this.prisma.$queryRaw<{ currencyId: string; category: ExpenseCategory; month: number; total: bigint | null; count: number }[]>`
        SELECT w."currencyId" AS "currencyId",
               w."category"::text AS "category",
               EXTRACT(MONTH FROM w."processedAt")::int AS "month",
               SUM(w."amount")::bigint AS "total",
               COUNT(*)::int AS "count"
        FROM "platform_withdrawals" w
        WHERE w."status" = 'PAID'
          AND w."processedAt" >= ${start} AND w."processedAt" < ${end}
        GROUP BY w."currencyId", w."category", EXTRACT(MONTH FROM w."processedAt")
      `,
      this.prisma.walletTransaction.aggregate({ _min: { createdAt: true } }),
    ]);

    const byCurrency = new Map<string, Accumulator>();
    const accFor = (currencyId: string) => {
      let acc = byCurrency.get(currencyId);
      if (!acc) {
        acc = emptyAccumulator();
        byCurrency.set(currencyId, acc);
      }
      return acc;
    };
    for (const row of commissionRows) accFor(row.currencyId).commissions[row.month - 1] += row.total ?? 0n;
    for (const row of payoutRows) {
      const acc = accFor(row.currencyId);
      acc.payouts[row.month - 1] += row.total ?? 0n;
      acc.payoutCount[row.month - 1] += row.count;
    }
    for (const row of expenseRows) {
      const acc = accFor(row.currencyId);
      const total = row.total ?? 0n;
      acc.expenses[row.month - 1] += total;
      acc.expenseCount[row.month - 1] += row.count;
      if (acc.byCategory[row.category]) acc.byCategory[row.category][row.month - 1] += total;
    }

    const thisYear = new Date().getUTCFullYear();
    const firstYear = Math.min(firstTransaction._min.createdAt?.getUTCFullYear() ?? thisYear, year, thisYear);
    const years: number[] = [];
    for (let y = thisYear; y >= Math.max(firstYear, 2020); y -= 1) years.push(y);
    if (!years.includes(year)) years.push(year);

    return {
      year,
      generatedAt: new Date().toISOString(),
      years: years.sort((a, b) => b - a),
      currencies: currencies.map((currency) => {
        const acc = accFor(currency.id);
        return {
          currencyId: currency.id,
          isoCode: currency.isoCode,
          months: MONTH_NAMES.map((name, index) => bucket(acc, name, index, index + 1)),
          semesters: [bucket(acc, '1er semestre', 0, 6), bucket(acc, '2e semestre', 6, 12)],
          year: bucket(acc, `Année ${year}`, 0, 12),
        };
      }),
    };
  }

  /**
   * Les dépenses PAYÉES de l'année, une ligne par retrait (export Excel / PDF). Les noms des personnes payées (salaires, primes) ne sortent
   * que pour ceux qui gèrent le portefeuille : les autres voient « Personnel ».
   */
  async paidExpenses(year: number, includeStaffNames: boolean): Promise<PaidExpenseRow[]> {
    const { start, end } = yearWindow(year);
    const rows = await this.prisma.platformWithdrawal.findMany({
      where: { status: PlatformWithdrawalStatus.PAID, processedAt: { gte: start, lt: end } },
      include: { currency: true, beneficiary: true },
      orderBy: { processedAt: 'asc' },
      take: 5000,
    });
    return rows.map((row) => {
      const details = (row.details ?? {}) as StoredExpenseDetails;
      const isStaff = row.category === 'SALARY' || row.category === 'BONUS';
      const subject = isStaff
        ? includeStaffNames
          ? (details.staff?.fullName ?? null)
          : 'Personnel'
        : (details.travel?.traveler ?? details.supplier?.name ?? details.reason ?? row.note ?? null);
      return {
        id: row.id,
        documentNumber: row.documentNumber,
        paidAt: (row.processedAt ?? row.requestedAt).toISOString(),
        category: row.category,
        motif: expenseCategoryText(row.category, row.categoryLabel),
        subject,
        beneficiary: row.beneficiary.label,
        isoCode: row.currency.isoCode,
        amount: row.amount.toString(),
        externalReference: row.externalReference,
      };
    });
  }
}
