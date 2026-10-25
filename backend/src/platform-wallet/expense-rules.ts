// backend/src/platform-wallet/expense-rules.ts
// [25/10/2026] v1 — Règles pures (sans base de données) d'un retrait avec motif : ce que chaque motif doit contenir, calcul des lignes
// d'une facture, calcul d'un bulletin de paie. Tout est en BigInt (plus petite unité de la devise) : aucun flottant n'entre dans un montant.
import { BadRequestException } from '@nestjs/common';
import type { ExpenseCategory } from '@prisma/client';
import {
  EXPENSE_CATEGORIES,
  ExpenseLine,
  PayslipDeductionSnapshot,
  PayslipLineSnapshot,
  PayslipSnapshot,
  StoredExpenseDetails,
} from './expense-categories';

const MAX_AMOUNT = 10n ** 15n;
const MAX_LINES = 50;
const MONEY = /^[1-9]\d{0,14}$/;
const ZERO_OR_MONEY = /^(0|[1-9]\d{0,14})$/;

// ─── Entrée d'un retrait avec motif ───────────────────────────────────────────────────────────────────────────────────────────

export interface ExpenseInput {
  category: ExpenseCategory;
  categoryLabel?: string;
  reason?: string;
  staffUserId?: string;
  periodMonth?: string;
  supplier?: { name: string; address?: string; phone?: string; invoiceRef?: string };
  lines?: Array<{ description: string; quantity: number; unitPrice: string }>;
  travel?: { traveler: string; from: string; to: string; departureDate?: string; returnDate?: string; purpose?: string };
}

export interface ValidatedExpense {
  category: ExpenseCategory;
  /** Libellé saisi (« Autres » seulement). */
  categoryLabel: string | null;
  staffUserId: string | null;
  periodMonth: string | null;
  /** Montant imposé par les lignes (factures) ; null quand le montant est saisi (ou calculé : salaire). */
  amountFromLines: bigint | null;
  /** Ce qui est conservé pour produire la pièce (hors identité du personnel et bulletin, ajoutés par le service). */
  details: StoredExpenseDetails;
}

function clean(value: string | undefined | null): string | undefined {
  const trimmed = value?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed : undefined;
}

function need(value: string | undefined | null, message: string, min = 2): string {
  const text = clean(value);
  if (!text || text.length < min) throw new BadRequestException(message);
  return text;
}

/** « 2026-10 », pas dans le futur. */
export function validatePeriodMonth(period: string | undefined, now: Date = new Date()): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period ?? '');
  if (!match) throw new BadRequestException('Choisis le mois du salaire (format AAAA-MM).');
  const current = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const asked = Number(match[1]) * 12 + (Number(match[2]) - 1);
  if (asked > current) throw new BadRequestException('Le mois du salaire ne peut pas être dans le futur.');
  if (Number(match[1]) < 2020) throw new BadRequestException('Le mois du salaire est trop ancien.');
  return `${match[1]}-${match[2]}`;
}

/** Valide les lignes d'une facture / d'une note de frais et calcule les totaux. */
export function buildLines(lines: ExpenseInput['lines'], required: boolean): { lines: ExpenseLine[]; total: bigint } {
  if (!lines || lines.length === 0) {
    if (required) throw new BadRequestException('Ajoute au moins une ligne (désignation, quantité, prix unitaire).');
    return { lines: [], total: 0n };
  }
  if (lines.length > MAX_LINES) throw new BadRequestException(`Une pièce ne peut pas dépasser ${MAX_LINES} lignes.`);

  let total = 0n;
  const built = lines.map((line, index) => {
    const row = `Ligne ${index + 1} : `;
    const description = need(line.description, `${row}la désignation est obligatoire.`);
    if (description.length > 120) throw new BadRequestException(`${row}la désignation est trop longue (120 caractères au maximum).`);
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100_000) {
      throw new BadRequestException(`${row}la quantité doit être un nombre entier entre 1 et 100 000.`);
    }
    if (!MONEY.test(line.unitPrice ?? '')) throw new BadRequestException(`${row}le prix unitaire doit être un nombre entier supérieur à zéro.`);
    const lineTotal = BigInt(line.quantity) * BigInt(line.unitPrice);
    if (lineTotal >= MAX_AMOUNT) throw new BadRequestException(`${row}le total de la ligne est trop grand.`);
    total += lineTotal;
    return { description, quantity: line.quantity, unitPrice: line.unitPrice, total: lineTotal.toString() };
  });
  if (total >= MAX_AMOUNT) throw new BadRequestException('Le total de la pièce est trop grand.');
  return { lines: built, total };
}

/**
 * Vérifie que la saisie contient ce que le motif exige, et la ramène à ce qui sera conservé. Les contrôles qui demandent la base
 * (la personne existe, fait partie de l'équipe, fiche de paie complète) sont faits par le service.
 */
export function validateExpenseInput(input: ExpenseInput, now: Date = new Date()): ValidatedExpense {
  const info = EXPENSE_CATEGORIES[input.category];
  const details: StoredExpenseDetails = {};
  let categoryLabel: string | null = null;
  let staffUserId: string | null = null;
  let periodMonth: string | null = null;
  let amountFromLines: bigint | null = null;

  if (info.needsStaff) {
    staffUserId = clean(input.staffUserId) ?? null;
    if (!staffUserId) throw new BadRequestException('Choisis la personne concernée.');
  }
  if (info.needsPeriod) periodMonth = validatePeriodMonth(input.periodMonth, now);

  switch (input.category) {
    case 'SALARY':
      // Le montant du retrait est le net à payer calculé par le service depuis la fiche de paie : rien d'autre à saisir.
      break;
    case 'BONUS':
      details.reason = need(input.reason, 'Indique pour quelle raison la prime est versée.', 3);
      break;
    case 'OPERATING':
      details.reason = need(input.reason, "Indique l'objet de la dépense.", 3);
      break;
    case 'OTHER':
      categoryLabel = need(input.categoryLabel, 'Saisis le motif (par exemple « Frais de réception »).', 2);
      if (categoryLabel.length > 60) throw new BadRequestException('Le motif est trop long (60 caractères au maximum).');
      details.reason = need(input.reason, "Indique l'objet de la dépense.", 3);
      break;
    case 'TRAVEL': {
      const travel = input.travel;
      if (!travel) throw new BadRequestException('Renseigne le voyage (voyageur, départ, destination).');
      details.travel = {
        traveler: need(travel.traveler, 'Indique qui voyage.'),
        from: need(travel.from, 'Indique le lieu de départ.'),
        to: need(travel.to, 'Indique la destination.'),
        departureDate: clean(travel.departureDate),
        returnDate: clean(travel.returnDate),
        purpose: need(travel.purpose ?? input.reason, 'Indique le but du voyage.', 3),
      };
      const detailed = buildLines(input.lines, false);
      if (detailed.lines.length > 0) {
        details.lines = detailed.lines;
        amountFromLines = detailed.total;
      }
      break;
    }
    case 'SUPPLIES':
    case 'OFFICE_EQUIPMENT': {
      const supplier = input.supplier;
      details.supplier = {
        name: need(supplier?.name, 'Indique le fournisseur.'),
        address: clean(supplier?.address),
        phone: clean(supplier?.phone),
        invoiceRef: clean(supplier?.invoiceRef),
      };
      const built = buildLines(input.lines, true);
      details.lines = built.lines;
      amountFromLines = built.total;
      details.reason = clean(input.reason);
      break;
    }
  }

  if (input.category === 'BONUS' || input.category === 'SALARY') {
    // Une prime / un salaire ne porte ni fournisseur ni lignes : on ne garde que ce qui sert.
    delete details.supplier;
    delete details.lines;
  }
  return { category: input.category, categoryLabel, staffUserId, periodMonth, amountFromLines, details };
}

/** « BUL-2026-000012 » : préfixe du motif, année, numéro de la séquence (jamais réutilisé, même si un retrait échoue). */
export function formatDocumentNumber(prefix: string, year: number, sequence: bigint | number): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, '0')}`;
}

// ─── Fiche de paie ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface PayDeduction {
  label: string;
  kind: 'PERCENT' | 'FIXED';
  /** PERCENT : centièmes de pour cent (500 = 5 %) ; FIXED : montant. */
  value: string;
}

function asArray(json: unknown): unknown[] {
  return Array.isArray(json) ? json : [];
}

/** Primes / indemnités fixes. `strict` (enregistrement d'une fiche) refuse une ligne invalide ; sinon (lecture) elle est ignorée. */
export function readAllowances(json: unknown, strict = false): PayslipLineSnapshot[] {
  const result: PayslipLineSnapshot[] = [];
  for (const item of asArray(json)) {
    const entry = item as { label?: unknown; amount?: unknown };
    const label = typeof entry?.label === 'string' ? clean(entry.label) : undefined;
    const amount = typeof entry?.amount === 'number' ? String(entry.amount) : typeof entry?.amount === 'string' ? entry.amount.trim() : '';
    if (!label || label.length > 60 || !MONEY.test(amount)) {
      if (strict) throw new BadRequestException('Chaque prime ou indemnité doit avoir un libellé (60 caractères max) et un montant entier supérieur à zéro.');
      continue;
    }
    result.push({ label, amount });
  }
  if (strict && result.length > 20) throw new BadRequestException('Au maximum 20 primes ou indemnités.');
  return result;
}

/** Retenues (cotisations, impôt…). Mêmes règles de lecture que les primes. */
export function readDeductions(json: unknown, strict = false): PayDeduction[] {
  const result: PayDeduction[] = [];
  for (const item of asArray(json)) {
    const entry = item as { label?: unknown; kind?: unknown; value?: unknown };
    const label = typeof entry?.label === 'string' ? clean(entry.label) : undefined;
    const kind = entry?.kind === 'PERCENT' || entry?.kind === 'FIXED' ? entry.kind : undefined;
    const value = typeof entry?.value === 'number' ? String(entry.value) : typeof entry?.value === 'string' ? entry.value.trim() : '';
    const valid =
      !!label &&
      label.length <= 60 &&
      !!kind &&
      ZERO_OR_MONEY.test(value) &&
      (kind === 'FIXED' ? value !== '0' : BigInt(value) <= 10_000n);
    if (!valid) {
      if (strict) {
        throw new BadRequestException(
          'Chaque retenue doit avoir un libellé, un type (pourcentage ou montant) et une valeur : en pourcentage, entre 1 et 10 000 centièmes de pour cent (500 = 5 %).',
        );
      }
      continue;
    }
    result.push({ label: label as string, kind: kind as 'PERCENT' | 'FIXED', value });
  }
  if (strict && result.length > 20) throw new BadRequestException('Au maximum 20 retenues.');
  return result;
}

/** Brut = salaire de base + primes ; retenue en % = arrondi à l'unité la plus proche (demi vers le haut) sur le brut ; net = brut − retenues. */
export function computePayslip(input: {
  period: string;
  baseSalary: bigint;
  allowances: PayslipLineSnapshot[];
  deductions: PayDeduction[];
}): PayslipSnapshot {
  if (input.baseSalary <= 0n) {
    throw new BadRequestException("La fiche de paie de cette personne n'a pas de salaire de base : renseigne-la d'abord dans Comptabilité › Personnel.");
  }
  const allowancesTotal = input.allowances.reduce((sum, line) => sum + BigInt(line.amount), 0n);
  const gross = input.baseSalary + allowancesTotal;

  const deductions: PayslipDeductionSnapshot[] = input.deductions.map((line) => {
    const amount = line.kind === 'FIXED' ? BigInt(line.value) : (gross * BigInt(line.value) + 5000n) / 10000n;
    return { label: line.label, kind: line.kind, value: line.value, amount: amount.toString() };
  });
  const totalDeductions = deductions.reduce((sum, line) => sum + BigInt(line.amount), 0n);
  const net = gross - totalDeductions;
  if (net <= 0n) throw new BadRequestException('Les retenues dépassent le salaire brut : vérifie la fiche de paie de cette personne.');
  if (gross >= MAX_AMOUNT) throw new BadRequestException('Le salaire brut est trop grand.');

  return {
    period: input.period,
    baseSalary: input.baseSalary.toString(),
    allowances: input.allowances,
    gross: gross.toString(),
    deductions,
    totalDeductions: totalDeductions.toString(),
    net: net.toString(),
  };
}
