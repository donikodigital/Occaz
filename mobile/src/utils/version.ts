// mobile/src/utils/version.ts
// [19/10/2026] v1 — Comparaison de versions « 1.4.0 » (sans dépendance) pour la mise à jour forcée.

/** Découpe « 1.4.0 » en [1, 4, 0] ; tout ce qui n'est pas un nombre devient 0 (« abc » => [0, 0, 0]). */
export function parseVersion(version: string | null | undefined): [number, number, number] {
  const parts = String(version ?? '').trim().split('.');
  const read = (index: number) => {
    const value = Number.parseInt(parts[index] ?? '0', 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };
  return [read(0), read(1), read(2)];
}

/** Négatif si a < b, 0 si égales, positif si a > b. */
export function compareVersions(a: string | null | undefined, b: string | null | undefined): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return 0;
}

/** Vrai si `current` est strictement plus ancienne que `minimum` ; « 0.0.0 » ou vide = aucune exigence. */
export function isUpdateRequired(current: string | null | undefined, minimum: string | null | undefined): boolean {
  if (!minimum) return false;
  return compareVersions(current, minimum) < 0;
}
