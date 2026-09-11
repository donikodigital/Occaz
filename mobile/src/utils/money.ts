// mobile/src/utils/money.ts
import type { Money } from '@/services/api/types';

/**
 * Les montants arrivent en chaîne (BigInt sérialisé côté backend, voir
 * services/api/types.ts) — toujours passer par ces fonctions plutôt que
 * de manipuler la chaîne à la main dans un écran.
 */
export function formatMoney(amount: Money | number, currencyCode = 'GNF'): string {
  const numeric = typeof amount === 'string' ? Number(amount) : amount;
  const formatted = Number.isFinite(numeric) ? new Intl.NumberFormat('fr-FR').format(numeric) : '0';
  return currencyCode ? `${formatted} ${currencyCode}` : formatted;
}
