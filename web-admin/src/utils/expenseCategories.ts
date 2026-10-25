// web-admin/src/utils/expenseCategories.ts
// [25/10/2026] v1 — Les motifs d'un retrait de la plateforme : libellé, pièce produite, ce que le motif exige. Miroir de
// backend/src/platform-wallet/expense-categories.ts (le serveur reste l'autorité : il refuse toute saisie incomplète).
import type { ExpenseCategory } from '@/types/platform-wallet.types';

export interface ExpenseCategoryInfo {
  label: string;
  /** La pièce PDF qui sera produite. */
  document: string;
  /** Une phrase qui dit quoi saisir. */
  hint: string;
  needsStaff: boolean;
  needsPeriod: boolean;
  needsSupplier: boolean;
  /** Lignes obligatoires : le montant est leur somme. */
  needsLines: boolean;
}

export const EXPENSE_CATEGORY_ORDER: ExpenseCategory[] = ['SALARY', 'BONUS', 'OPERATING', 'TRAVEL', 'SUPPLIES', 'OFFICE_EQUIPMENT', 'OTHER'];

export const EXPENSE_CATEGORY_INFO: Record<ExpenseCategory, ExpenseCategoryInfo> = {
  SALARY: {
    label: 'Salaire',
    document: 'Bulletin de paie',
    hint: 'Choisis la personne et le mois : le bulletin est calculé depuis sa fiche de paie, et son net à payer devient le montant.',
    needsStaff: true,
    needsPeriod: true,
    needsSupplier: false,
    needsLines: false,
  },
  BONUS: {
    label: 'Primes',
    document: 'Reçu de prime',
    hint: 'Choisis la personne et dis pourquoi la prime est versée.',
    needsStaff: true,
    needsPeriod: false,
    needsSupplier: false,
    needsLines: false,
  },
  OPERATING: {
    label: 'Fonctionnement',
    document: 'Justificatif de dépense',
    hint: 'Loyer, internet, électricité, entretien… Indique l’objet de la dépense.',
    needsStaff: false,
    needsPeriod: false,
    needsSupplier: false,
    needsLines: false,
  },
  TRAVEL: {
    label: 'Frais de voyage',
    document: 'Note de frais de voyage',
    hint: 'Qui voyage, d’où, vers où, pourquoi. Tu peux détailler les frais ligne par ligne : le montant est alors leur somme.',
    needsStaff: false,
    needsPeriod: false,
    needsSupplier: false,
    needsLines: false,
  },
  SUPPLIES: {
    label: 'Fournitures',
    document: 'Facture d’achat',
    hint: 'Le fournisseur et ce qui a été acheté : la facture est générée, et le montant est le total des lignes.',
    needsStaff: false,
    needsPeriod: false,
    needsSupplier: true,
    needsLines: true,
  },
  OFFICE_EQUIPMENT: {
    label: 'Équipements de bureau',
    document: 'Facture d’achat',
    hint: 'Le fournisseur et le matériel acheté (ordinateur, imprimante, mobilier…) : la facture est générée.',
    needsStaff: false,
    needsPeriod: false,
    needsSupplier: true,
    needsLines: true,
  },
  OTHER: {
    label: 'Autres',
    document: 'Justificatif de dépense',
    hint: 'Saisis toi-même le motif, puis l’objet de la dépense.',
    needsStaff: false,
    needsPeriod: false,
    needsSupplier: false,
    needsLines: false,
  },
};

/** Libellé affiché d'un retrait : pour « Autres », le motif saisi. */
export function expenseLabel(category: ExpenseCategory, custom?: string | null): string {
  if (category === 'OTHER' && custom?.trim()) return custom.trim();
  return EXPENSE_CATEGORY_INFO[category].label;
}

/** Les bulletins et reçus de prime contiennent des données personnelles : réservés à ceux qui gèrent le portefeuille. */
export function documentNeedsManage(category: ExpenseCategory): boolean {
  return category === 'SALARY' || category === 'BONUS';
}

/** « 2026-10 » → « octobre 2026 ». */
export function periodLabel(period: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!match) return period;
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 15)));
}

/** Les 12 derniers mois (le mois en cours compris), du plus récent au plus ancien. */
export function recentPeriods(now: Date = new Date()): Array<{ value: string; label: string }> {
  const result: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < 12; i += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    result.push({ value, label: periodLabel(value) });
  }
  return result;
}
