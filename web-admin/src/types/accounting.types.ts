// web-admin/src/types/accounting.types.ts
import type { Money } from '@/services/api/types';
import type { ExpenseCategory } from './platform-wallet.types';

/** Les montants d'une période (un mois, un semestre ou l'année), dans UNE devise. */
export interface AccountingBucket {
  label: string;
  /** Commissions encaissées par la plateforme. */
  commissions: Money;
  /** Retraits de conducteurs payés. */
  driverPayouts: Money;
  driverPayoutCount: number;
  /** Retraits de la plateforme payés (dépenses de l'administration). */
  adminExpenses: Money;
  adminExpenseCount: number;
  /** Dépenses de l'administration par motif (tous les motifs, même à 0). */
  byCategory: Record<ExpenseCategory, Money>;
  /** Commissions − dépenses de l'administration (peut être négatif). */
  result: Money;
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

export interface PayAllowance {
  label: string;
  amount: Money;
}

export interface PayDeduction {
  label: string;
  kind: 'PERCENT' | 'FIXED';
  /** PERCENT : centièmes de pour cent (500 = 5 %) ; FIXED : montant. */
  value: string;
}

export interface StaffPayProfile {
  fullName: string | null;
  employeeNumber: string | null;
  jobTitle: string | null;
  hireDate: string | null;
  socialSecurityNumber: string | null;
  baseSalary: Money;
  currencyId: string;
  isoCode: string;
  allowances: PayAllowance[];
  deductions: PayDeduction[];
  updatedAt: string;
}

/** Un membre du personnel de l'administration et l'état de sa fiche de paie. */
export interface StaffPaySummary {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string;
  address: string | null;
  roles: string[];
  isActive: boolean;
  /** Faux pour un compte sans identité (SuperAdmin) : le nom du bulletin se saisit dans la fiche. */
  hasIdentity: boolean;
  /** Vrai quand la fiche permet de produire un bulletin. */
  payReady: boolean;
  pay: StaffPayProfile | null;
}

export interface StaffPayProfileInput {
  fullName?: string;
  employeeNumber?: string;
  jobTitle?: string;
  hireDate?: string;
  socialSecurityNumber?: string;
  baseSalary: Money;
  currencyId: string;
  allowances: PayAllowance[];
  deductions: PayDeduction[];
}
