// mobile/src/utils/money.ts
import type { Money } from '@/services/api/types';

/**
 * Les montants arrivent en chaîne (BigInt sérialisé côté backend, voir
 * services/api/types.ts) — toujours passer par ces fonctions plutôt que
 * de manipuler la chaîne à la main dans un écran.
 */
/**
 * Code ISO de la devise d'un trajet ou d'une réservation (« GNF », « XOF »…). Les montants d'un trajet sont dans la devise du pays de
 * sa ville de départ : toujours la passer à formatMoney, jamais compter sur le « GNF » par défaut ci-dessous (faux pour un départ au
 * Sénégal). Une réservation porte la devise de son trajet.
 */
export function currencyOf(entity: {
  currency?: { isoCode: string } | null;
  trip?: { currency?: { isoCode: string } | null } | null;
} | null | undefined): string | undefined {
  return entity?.currency?.isoCode ?? entity?.trip?.currency?.isoCode ?? undefined;
}

export function formatMoney(amount: Money | number, currencyCode = 'GNF'): string {
  const numeric = typeof amount === 'string' ? Number(amount) : amount;
  const formatted = Number.isFinite(numeric) ? new Intl.NumberFormat('fr-FR').format(numeric) : '0';
  return currencyCode ? `${formatted} ${currencyCode}` : formatted;
}
