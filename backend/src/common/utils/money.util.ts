// backend/src/common/utils/money.util.ts
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
  const asString = typeof value === 'number' ? value.toString() : value;
  if (!/^\d+$/.test(asString)) {
    throw new Error(`Montant invalide : "${asString}" doit être un entier positif.`);
  }
  return BigInt(asString);
}

/** Formate un montant BigInt pour affichage/API (string, jamais number). */
export function formatMoney(amount: bigint): string {
  return amount.toString();
}

/** Additionne une liste de montants BigInt en toute sécurité. */
export function sumMoney(amounts: bigint[]): bigint {
  return amounts.reduce((total, current) => total + current, 0n);
}
