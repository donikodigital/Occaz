// backend/src/common/utils/money.util.ts
// [19/10/2026] v2 — une saisie invalide renvoie maintenant une erreur 400 claire (avant : Error simple => réponse 500 « Internal server error »),
// et un montant démesuré est refusé avant d'atteindre la base (colonne BIGINT : 9 223 372 036 854 775 807 au maximum).
import { BadRequestException } from '@nestjs/common';

/** 15 chiffres au plus : très au-delà de tout montant réel (999 999 999 999 999) et très en deçà de la limite BIGINT. */
export const MAX_MONEY_DIGITS = 15;

/**
 * Toute somme d'argent transite en BigInt côté serveur/DB (plus petite
 * unité de la devise — voir en-tête de schema.prisma). Ces helpers
 * centralisent la conversion aux frontières de l'API pour qu'aucun module
 * ne réinvente sa propre logique de parsing/formatage.
 */

/**
 * Convertit une entrée utilisateur (montant en unité "humaine" GNF/XOF,
 * sans décimales) en BigInt. Rejette les valeurs non entières ou négatives.
 */
export function toMoneyBigInt(value: number | string): bigint {
  const asString = String(value ?? '');
  if (!/^\d+$/.test(asString)) {
    throw new BadRequestException('Montant invalide : saisis un nombre entier positif, sans virgule ni signe.');
  }
  if (asString.replace(/^0+(?=\d)/, '').length > MAX_MONEY_DIGITS) {
    throw new BadRequestException('Montant invalide : il est beaucoup trop grand.');
  }
  return BigInt(asString);
}

/** Comme toMoneyBigInt, mais exige un montant STRICTEMENT positif (retraits, remboursements : zéro n'a aucun sens). */
export function toPositiveMoneyBigInt(value: number | string): bigint {
  const amount = toMoneyBigInt(value);
  if (amount <= 0n) throw new BadRequestException('Le montant doit être supérieur à zéro.');
  return amount;
}

/** Formate un montant BigInt pour affichage/API (string, jamais number). */
export function formatMoney(amount: bigint): string {
  return amount.toString();
}

/**
 * Montant lisible AVEC sa devise, pour les textes envoyés aux gens (notifications, SMS, e-mails) : « 3 875 XOF ».
 * Un montant sans devise (« 662 ont été ajoutés… ») ne dit pas s'il s'agit de francs guinéens ou de francs CFA — et les deux
 * circulent dans l'application. Les séparateurs de milliers suivent l'usage français.
 */
export function formatMoneyWithCurrency(amount: bigint | number | string, isoCode: string): string {
  const value = typeof amount === 'bigint' ? amount : BigInt(typeof amount === 'number' ? Math.round(amount) : amount);
  return `${new Intl.NumberFormat('fr-FR').format(value)} ${isoCode}`.trim();
}

/** Additionne une liste de montants BigInt en toute sécurité. */
export function sumMoney(amounts: bigint[]): bigint {
  return amounts.reduce((total, current) => total + current, 0n);
}
