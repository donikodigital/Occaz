// web-admin/src/utils/money.ts
import type { Money } from '@/services/api/types';

/** Les montants arrivent en chaîne (BigInt sérialisé côté backend) — toujours passer par cette fonction. */
export function formatMoney(amount: Money | number, currencyCode = 'GNF'): string {
  const numeric = typeof amount === 'string' ? Number(amount) : amount;
  const formatted = Number.isFinite(numeric) ? new Intl.NumberFormat('fr-FR').format(numeric) : '0';
  return currencyCode ? `${formatted} ${currencyCode}` : formatted;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}
