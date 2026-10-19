// backend/src/common/safety/simulation-guard.ts
// [19/10/2026] v1 — Les prestataires SIMULÉS (paiement encaissé sans argent réel) ne tournent plus en production par accident.
// Hors production (développement, tests, CI) : toujours autorisés. En production : refusés, sauf si ALLOW_SIMULATED_PAYMENTS=true est
// posé volontairement (phase de test avec de faux paiements, jamais avec de vrais utilisateurs).
import { ServiceUnavailableException } from '@nestjs/common';

export function isSimulationAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.ALLOW_SIMULATED_PAYMENTS === 'true';
}

/** Lève une erreur 503 claire quand la simulation est interdite : mieux vaut un paiement refusé qu'une réservation « payée » à zéro franc. */
export function assertSimulationAllowed(what: string, env: NodeJS.ProcessEnv = process.env): void {
  if (isSimulationAllowed(env)) return;
  throw new ServiceUnavailableException(
    `${what} n'est pas encore disponible : le prestataire de paiement n'est pas branché. Réessaie plus tard ou contacte le support Occa'Z.`,
  );
}
