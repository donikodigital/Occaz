// backend/src/common/utils/bigint-json.util.ts
/**
 * Les montants du schéma (Trip.pricePerSeat, Wallet.balance, etc.) sont des
 * BigInt — JSON.stringify ne sait pas les sérialiser nativement ("Do not
 * know how to serialize a BigInt"). On corrige `toJSON` une fois au
 * démarrage plutôt que de convertir manuellement à chaque DTO de sortie.
 * Converti en string (pas en number) pour ne jamais perdre de précision
 * sur de gros soldes cumulés.
 *
 * Appelé une seule fois depuis main.ts, avant que Nest ne démarre à
 * accepter des requêtes.
 */
export function patchBigIntJsonSerialization(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (BigInt.prototype as any).toJSON = function (this: bigint) {
    return this.toString();
  };
}
