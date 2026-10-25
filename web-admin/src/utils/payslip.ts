// web-admin/src/utils/payslip.ts
// [25/10/2026] v1 — Estimation du bulletin pendant la saisie d'une fiche de paie. Même calcul que le serveur (backend expense-rules.ts,
// computePayslip) : brut = base + primes ; retenue en % = arrondi à l'unité la plus proche (demi vers le haut) sur le brut ; net = brut − retenues.
// Le serveur recalcule toujours : ceci ne sert qu'à montrer le net avant d'enregistrer.
import type { PayAllowance, PayDeduction } from '@/types/accounting.types';

export interface PayslipEstimate {
  gross: bigint;
  deductions: Array<{ label: string; amount: bigint }>;
  totalDeductions: bigint;
  net: bigint;
}

function toBigInt(value: string): bigint {
  return /^\d{1,15}$/.test(value) ? BigInt(value) : 0n;
}

export function estimatePayslip(baseSalary: string, allowances: PayAllowance[], deductions: PayDeduction[]): PayslipEstimate {
  const gross = toBigInt(baseSalary) + allowances.reduce((sum, line) => sum + toBigInt(line.amount), 0n);
  const lines = deductions.map((line) => ({
    label: line.label,
    amount: line.kind === 'FIXED' ? toBigInt(line.value) : (gross * toBigInt(line.value) + 5000n) / 10000n,
  }));
  const totalDeductions = lines.reduce((sum, line) => sum + line.amount, 0n);
  return { gross, deductions: lines, totalDeductions, net: gross - totalDeductions };
}

/** « 5 » ou « 5,5 » (pour cent) → centièmes de pour cent (« 500 », « 550 ») ; texte vide ou invalide → ''. */
export function percentToBasisPoints(input: string): string {
  const normalized = input.replace(',', '.').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(normalized)) return '';
  const points = Math.round(Number(normalized) * 100);
  return points >= 1 && points <= 10_000 ? String(points) : '';
}

/** Centièmes de pour cent → « 5 » ou « 5,5 » pour l'affichage dans le champ. */
export function basisPointsToPercent(value: string): string {
  const points = Number(value);
  if (!Number.isFinite(points)) return '';
  return String(points / 100).replace('.', ',');
}
