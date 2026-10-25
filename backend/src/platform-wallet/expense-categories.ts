// backend/src/platform-wallet/expense-categories.ts
// [25/10/2026] v1 — Les motifs d'un retrait de la plateforme et ce que chacun exige / produit.
//
//   Motif              Pièce produite                         Ce que la saisie doit contenir
//   Salaire            Bulletin de paie                       la personne + le mois ; le montant EST le net calculé depuis sa fiche de paie
//   Primes             Reçu de prime                          la personne + l'objet de la prime
//   Fonctionnement     Justificatif de dépense                l'objet (ou des lignes détaillées)
//   Frais de voyage    Note de frais de voyage                le voyageur, le trajet, l'objet (+ lignes facultatives)
//   Fournitures        Facture d'achat                        le fournisseur + des lignes (le montant est leur somme)
//   Équipements        Facture d'achat                        le fournisseur + des lignes (le montant est leur somme)
//   Autres             Justificatif de dépense                le libellé du motif + l'objet
import type { ExpenseCategory } from '@prisma/client';

export interface ExpenseCategoryInfo {
  key: ExpenseCategory;
  /** Nom du motif dans les listes. */
  label: string;
  /** Titre en en-tête de la pièce PDF. */
  documentTitle: string;
  /** Nom de fichier du PDF (sans accent ni espace). */
  fileSlug: string;
  /** Préfixe du numéro de pièce : « BUL-2026-000012 ». */
  prefix: string;
  /** Le retrait concerne un membre de l'équipe (identité reprise de son compte). */
  needsStaff: boolean;
  /** Mois concerné (salaire). */
  needsPeriod: boolean;
  /** Fournisseur obligatoire. */
  needsSupplier: boolean;
  /** Lignes détaillées obligatoires : le montant du retrait est alors leur somme exacte. */
  needsLines: boolean;
}

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, ExpenseCategoryInfo> = {
  SALARY: {
    key: 'SALARY',
    label: 'Salaire',
    documentTitle: 'BULLETIN DE PAIE',
    fileSlug: 'bulletin-de-paie',
    prefix: 'BUL',
    needsStaff: true,
    needsPeriod: true,
    needsSupplier: false,
    needsLines: false,
  },
  BONUS: {
    key: 'BONUS',
    label: 'Primes',
    documentTitle: 'REÇU DE PRIME',
    fileSlug: 'recu-de-prime',
    prefix: 'PRI',
    needsStaff: true,
    needsPeriod: false,
    needsSupplier: false,
    needsLines: false,
  },
  OPERATING: {
    key: 'OPERATING',
    label: 'Fonctionnement',
    documentTitle: 'JUSTIFICATIF DE DÉPENSE',
    fileSlug: 'justificatif-de-depense',
    prefix: 'DEP',
    needsStaff: false,
    needsPeriod: false,
    needsSupplier: false,
    needsLines: false,
  },
  TRAVEL: {
    key: 'TRAVEL',
    label: 'Frais de voyage',
    documentTitle: 'NOTE DE FRAIS DE VOYAGE',
    fileSlug: 'note-de-frais',
    prefix: 'NDF',
    needsStaff: false,
    needsPeriod: false,
    needsSupplier: false,
    needsLines: false,
  },
  SUPPLIES: {
    key: 'SUPPLIES',
    label: 'Fournitures',
    documentTitle: "FACTURE D'ACHAT",
    fileSlug: 'facture-achat',
    prefix: 'FAC',
    needsStaff: false,
    needsPeriod: false,
    needsSupplier: true,
    needsLines: true,
  },
  OFFICE_EQUIPMENT: {
    key: 'OFFICE_EQUIPMENT',
    label: 'Équipements de bureau',
    documentTitle: "FACTURE D'ACHAT",
    fileSlug: 'facture-achat',
    prefix: 'FAC',
    needsStaff: false,
    needsPeriod: false,
    needsSupplier: true,
    needsLines: true,
  },
  OTHER: {
    key: 'OTHER',
    label: 'Autres',
    documentTitle: 'JUSTIFICATIF DE DÉPENSE',
    fileSlug: 'justificatif-de-depense',
    prefix: 'DEP',
    needsStaff: false,
    needsPeriod: false,
    needsSupplier: false,
    needsLines: false,
  },
};

/** Ordre d'affichage dans les listes et les rapports. */
export const EXPENSE_CATEGORY_ORDER: ExpenseCategory[] = ['SALARY', 'BONUS', 'OPERATING', 'TRAVEL', 'SUPPLIES', 'OFFICE_EQUIPMENT', 'OTHER'];

/** Libellé affiché : pour « Autres », le texte saisi à la main. */
export function expenseCategoryText(category: ExpenseCategory, custom?: string | null): string {
  if (category === 'OTHER' && custom?.trim()) return custom.trim();
  return EXPENSE_CATEGORIES[category].label;
}

// ─── Ce qui est conservé avec le retrait pour produire la pièce ────────────────────────────────────────────────────────────

export interface ExpenseLine {
  description: string;
  quantity: number;
  /** Prix unitaire, plus petite unité de la devise (texte). */
  unitPrice: string;
  /** quantité × prix unitaire (texte). */
  total: string;
}

export interface PayslipLineSnapshot {
  label: string;
  amount: string;
}

export interface PayslipDeductionSnapshot extends PayslipLineSnapshot {
  kind: 'PERCENT' | 'FIXED';
  /** PERCENT : centièmes de pour cent (500 = 5 %) ; FIXED : le montant. */
  value: string;
}

export interface PayslipSnapshot {
  period: string; // « 2026-10 »
  baseSalary: string;
  allowances: PayslipLineSnapshot[];
  gross: string;
  deductions: PayslipDeductionSnapshot[];
  totalDeductions: string;
  net: string;
}

/** Identité de la personne, figée au moment du retrait : la pièce ne change pas si sa fiche change ensuite. */
export interface StaffSnapshot {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string;
  address: string | null;
  roles: string[];
  employeeNumber: string | null;
  jobTitle: string | null;
  hireDate: string | null; // AAAA-MM-JJ
  socialSecurityNumber: string | null;
}

export interface StoredExpenseDetails {
  /** Objet de la dépense (prime, fonctionnement, autre…). */
  reason?: string;
  supplier?: { name: string; address?: string; phone?: string; invoiceRef?: string };
  lines?: ExpenseLine[];
  travel?: { traveler: string; from: string; to: string; departureDate?: string; returnDate?: string; purpose?: string };
  staff?: StaffSnapshot;
  payslip?: PayslipSnapshot;
}

/** « 2026-10 » → « octobre 2026 ». */
export function periodLabel(period: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) return period;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 15));
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}
