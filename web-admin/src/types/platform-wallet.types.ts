// web-admin/src/types/platform-wallet.types.ts
import type { Money } from '@/services/api/types';

export type BeneficiaryKind = 'OWNER' | 'SUPPORT' | 'STAFF' | 'OTHER';
export type PlatformWithdrawalStatus = 'PROCESSING' | 'PAID' | 'FAILED';

/** Motif d'un retrait : décide de ce qu'il faut saisir et de la pièce PDF produite. */
export type ExpenseCategory = 'SALARY' | 'BONUS' | 'OPERATING' | 'TRAVEL' | 'SUPPLIES' | 'OFFICE_EQUIPMENT' | 'OTHER';

/** Solde de la plateforme pour une devise (XOF ou GNF). Tous les montants sont en plus petite unité, sous forme de texte. */
export interface CurrencyBalance {
  currencyId: string;
  isoCode: string;
  /** Commissions libérées depuis le début. */
  earned: Money;
  /** Commissions des courses pas encore terminées : pas encore retirables. */
  pending: Money;
  /** Déjà retiré (payé). */
  withdrawn: Money;
  /** Retraits envoyés mais pas encore confirmés. */
  inProgress: Money;
  /** Ce qui peut être retiré maintenant. */
  available: Money;
}

export interface PlatformWalletOverview {
  balances: CurrencyBalance[];
  inProgressCount: number;
  /** Aucun vrai virement ne part du serveur (prestataire simulé). */
  providerSimulated: boolean;
  /** Vrai en production tant qu'Orange Money n'est pas branché : le virement se fait à la main, puis « Marquer payé ». */
  manualTransfer: boolean;
}

export interface PlatformBeneficiary {
  id: string;
  label: string;
  holderName: string;
  kind: BeneficiaryKind;
  method: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
}

export interface PlatformWithdrawal {
  id: string;
  beneficiaryId: string;
  beneficiary: PlatformBeneficiary;
  amount: Money;
  currencyId: string;
  currency: { isoCode: string };
  status: PlatformWithdrawalStatus;
  method: string;
  destinationRef: string;
  note: string | null;
  externalReference: string | null;
  failureReason: string | null;
  requestedBy?: { id: string; email: string | null; phone: string } | null;
  requestedAt: string;
  processedAt: string | null;
  /** Motif et pièce comptable (les retraits d'avant les motifs n'ont ni numéro ni pièce). */
  category: ExpenseCategory;
  /** Libellé saisi quand le motif est « Autres ». */
  categoryLabel: string | null;
  documentNumber: string | null;
  hasDocument: boolean;
  periodMonth: string | null;
  /** La personne, le voyageur ou le fournisseur concerné. */
  subject: string | null;
}

export interface BeneficiaryInput {
  label: string;
  holderName: string;
  kind: BeneficiaryKind;
  phone: string;
}

export interface ExpenseLineInput {
  description: string;
  quantity: number;
  /** Prix unitaire, entier supérieur à zéro. */
  unitPrice: Money;
}

/** Ce que le motif exige (voir backend expense-categories.ts) : le serveur refuse toute saisie incomplète. */
export interface ExpenseMotifInput {
  category: ExpenseCategory;
  categoryLabel?: string;
  reason?: string;
  staffUserId?: string;
  /** « 2026-10 » (salaire). */
  periodMonth?: string;
  supplier?: { name: string; address?: string; phone?: string; invoiceRef?: string };
  lines?: ExpenseLineInput[];
  travel?: { traveler: string; from: string; to: string; departureDate?: string; returnDate?: string; purpose?: string };
}

/** Étape 1 d'un retrait : demande du code de confirmation envoyé par e-mail. */
export interface WithdrawalCodeRequest extends ExpenseMotifInput {
  beneficiaryId: string;
  currencyId: string;
  amount: Money;
}

export interface PayslipLine {
  label: string;
  amount: Money;
}

export interface PayslipDeduction extends PayslipLine {
  kind: 'PERCENT' | 'FIXED';
  value: string;
}

export interface Payslip {
  period: string;
  baseSalary: Money;
  allowances: PayslipLine[];
  gross: Money;
  deductions: PayslipDeduction[];
  totalDeductions: Money;
  net: Money;
}

/** Aperçu du bulletin d'une personne pour un mois : le net à payer remplit le montant du retrait « Salaire ». */
export interface PayslipPreview {
  staff: { userId: string; fullName: string; jobTitle: string | null; roles: string[] };
  payslip: Payslip;
  currencyId: string;
  isoCode: string;
  periodLabel: string;
  /** Numéro de la pièce si ce salaire a déjà été versé (ou est en cours). */
  alreadyPaid: string | null;
}

export interface WithdrawalCodeResponse {
  expiresInSeconds: number;
  /** Adresse e-mail d'envoi, masquée par le serveur (ex. t***@gmail.com). */
  sentTo: string;
}

/** Étape 2 : le code reçu par e-mail remplace le mot de passe. */
export interface WithdrawalInput extends WithdrawalCodeRequest {
  note?: string;
  code: string;
}
