// backend/src/common/utils/duration.util.ts
/**
 * Convertit une chaîne de durée style JWT ("15m", "30d", "1h", "300s")
 * en millisecondes. Volontairement minimal (pas de dépendance externe) —
 * suffisant pour les usages internes (expiration de session, de token).
 */
const UNIT_TO_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationToMs(input: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(input.trim());
  if (!match) {
    throw new Error(`Format de durée invalide : "${input}" (attendu ex: "15m", "30d").`);
  }
  const [, amount, unit] = match;
  return parseInt(amount, 10) * UNIT_TO_MS[unit];
}

export function addDuration(input: string, from: Date = new Date()): Date {
  return new Date(from.getTime() + parseDurationToMs(input));
}
