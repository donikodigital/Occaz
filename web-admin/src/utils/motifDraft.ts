// web-admin/src/utils/motifDraft.ts
// [25/10/2026] v1 — Brouillon de saisie du motif d'un retrait (formulaire) : valeurs vides, validation côté écran (le serveur revérifie tout),
// montant imposé par le motif (salaire → net du bulletin ; facture / frais détaillés → somme des lignes), conversion vers l'API.
import type { ExpenseCategory, ExpenseLineInput, ExpenseMotifInput, PayslipPreview } from '@/types/platform-wallet.types';
import { EXPENSE_CATEGORY_INFO, recentPeriods } from '@/utils/expenseCategories';

export interface LineDraft {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface MotifDraft {
  category: ExpenseCategory;
  categoryLabel: string;
  reason: string;
  staffUserId: string;
  periodMonth: string;
  supplierName: string;
  supplierAddress: string;
  supplierPhone: string;
  supplierRef: string;
  lines: LineDraft[];
  traveler: string;
  from: string;
  to: string;
  departureDate: string;
  returnDate: string;
}

let lineCounter = 0;
export function newLine(): LineDraft {
  lineCounter += 1;
  return { id: `line-${Date.now()}-${lineCounter}`, description: '', quantity: '1', unitPrice: '' };
}

export function emptyMotifDraft(): MotifDraft {
  // Mois proposé : le mois écoulé (on paie le salaire d'un mois une fois qu'il est fini).
  const periods = recentPeriods();
  return {
    category: 'OPERATING',
    categoryLabel: '',
    reason: '',
    staffUserId: '',
    periodMonth: periods[1]?.value ?? periods[0].value,
    supplierName: '',
    supplierAddress: '',
    supplierPhone: '',
    supplierRef: '',
    lines: [newLine()],
    traveler: '',
    from: '',
    to: '',
    departureDate: '',
    returnDate: '',
  };
}

const trim = (value: string) => value.replace(/\s+/g, ' ').trim();
const isBlank = (line: LineDraft) => !trim(line.description) && !line.unitPrice;

export function lineIsValid(line: LineDraft): boolean {
  const quantity = Number(line.quantity);
  return trim(line.description).length >= 2 && Number.isInteger(quantity) && quantity >= 1 && quantity <= 100_000 && /^[1-9]\d{0,14}$/.test(line.unitPrice);
}

/** Les lignes remplies (une ligne entièrement vide est ignorée). */
export function filledLines(draft: MotifDraft): LineDraft[] {
  return draft.lines.filter((line) => !isBlank(line));
}

export function lineTotal(line: LineDraft): bigint {
  return lineIsValid(line) ? BigInt(line.quantity) * BigInt(line.unitPrice) : 0n;
}

export function linesTotal(draft: MotifDraft): bigint {
  return filledLines(draft).reduce((sum, line) => sum + lineTotal(line), 0n);
}

export type AmountMode = 'salary' | 'lines' | 'manual';

/** D'où vient le montant : du bulletin (salaire), du total des lignes, ou de la saisie. */
export function amountMode(draft: MotifDraft): AmountMode {
  if (draft.category === 'SALARY') return 'salary';
  if (EXPENSE_CATEGORY_INFO[draft.category].needsLines) return 'lines';
  if (draft.category === 'TRAVEL' && filledLines(draft).length > 0) return 'lines';
  return 'manual';
}

/** Montant imposé par le motif ; null quand il est saisi à la main (ou pas encore connu : bulletin en cours de calcul). */
export function fixedAmount(draft: MotifDraft, preview: PayslipPreview | undefined): bigint | null {
  const mode = amountMode(draft);
  if (mode === 'salary') return preview ? BigInt(preview.payslip.net) : null;
  if (mode === 'lines') return linesTotal(draft);
  return null;
}

/** Ce qu'il manque pour que le motif soit complet (null = complet). Même exigences que le serveur. */
export function draftIssue(draft: MotifDraft, preview: PayslipPreview | undefined): string | null {
  const info = EXPENSE_CATEGORY_INFO[draft.category];
  if (info.needsStaff && !draft.staffUserId) return 'Choisis la personne.';
  if (info.needsPeriod && !draft.periodMonth) return 'Choisis le mois.';
  if (draft.category === 'SALARY') {
    if (!preview) return 'Le bulletin n’est pas encore calculé.';
    if (preview.alreadyPaid) return `Ce salaire a déjà été versé (pièce ${preview.alreadyPaid}).`;
  }
  const reason = trim(draft.reason);
  if ((draft.category === 'BONUS' || draft.category === 'OPERATING' || draft.category === 'OTHER') && reason.length < 3) return 'Indique l’objet.';
  if (draft.category === 'OTHER' && trim(draft.categoryLabel).length < 2) return 'Saisis le motif.';
  if (draft.category === 'TRAVEL') {
    if (trim(draft.traveler).length < 2 || trim(draft.from).length < 2 || trim(draft.to).length < 2) return 'Renseigne le voyageur, le départ et la destination.';
    if (reason.length < 3) return 'Indique le but du voyage.';
  }
  if (info.needsSupplier && trim(draft.supplierName).length < 2) return 'Indique le fournisseur.';
  if (info.needsLines && filledLines(draft).length === 0) return 'Ajoute au moins une ligne.';
  if (draft.lines.some((line) => !isBlank(line) && !lineIsValid(line))) return 'Une ligne est incomplète (désignation, quantité, prix unitaire).';
  return null;
}

const optional = (value: string) => trim(value) || undefined;

/** Ce que l'API attend : seulement les champs utiles au motif choisi. */
export function draftToInput(draft: MotifDraft): ExpenseMotifInput {
  const info = EXPENSE_CATEGORY_INFO[draft.category];
  const input: ExpenseMotifInput = { category: draft.category };

  if (info.needsStaff) input.staffUserId = draft.staffUserId;
  if (info.needsPeriod) input.periodMonth = draft.periodMonth;
  if (draft.category === 'OTHER') input.categoryLabel = trim(draft.categoryLabel);
  if (draft.category === 'BONUS' || draft.category === 'OPERATING' || draft.category === 'OTHER') input.reason = trim(draft.reason);

  if (info.needsSupplier) {
    input.supplier = { name: trim(draft.supplierName), address: optional(draft.supplierAddress), phone: optional(draft.supplierPhone), invoiceRef: optional(draft.supplierRef) };
    input.reason = optional(draft.reason);
  }
  if (draft.category === 'TRAVEL') {
    input.travel = {
      traveler: trim(draft.traveler),
      from: trim(draft.from),
      to: trim(draft.to),
      departureDate: optional(draft.departureDate),
      returnDate: optional(draft.returnDate),
      purpose: trim(draft.reason),
    };
  }
  if (info.needsLines || draft.category === 'TRAVEL') {
    const lines: ExpenseLineInput[] = filledLines(draft).map((line) => ({ description: trim(line.description), quantity: Number(line.quantity), unitPrice: line.unitPrice }));
    if (lines.length > 0) input.lines = lines;
  }
  return input;
}
