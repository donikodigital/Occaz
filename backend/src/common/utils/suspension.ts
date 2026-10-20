// backend/src/common/utils/suspension.ts
// [20/10/2026] v1 — Début d'une suspension de compte (User.suspendedAt), partagé par la suspension d'un utilisateur (users.service.ts) et celle
// d'un conducteur (driver-profiles.service.ts).

/**
 * Date de début de la suspension à enregistrer au moment de suspendre un compte. Suspendre un compte déjà suspendu ne remet pas le compteur
 * des 6 mois à zéro : on garde la date de départ d'origine.
 */
export function suspensionStart(
  current: { isSuspended: boolean; suspendedAt: Date | null } | null | undefined,
  now: Date = new Date(),
): Date {
  return current?.isSuspended && current.suspendedAt ? current.suspendedAt : now;
}
