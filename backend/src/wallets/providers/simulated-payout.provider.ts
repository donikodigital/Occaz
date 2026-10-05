// backend/src/wallets/providers/simulated-payout.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DisburseOutcome, DisburseParams, PayoutProvider } from './payout-provider.interface';

/**
 * Prestataire de retrait SIMULÉ — utilisé tant que l'API Orange Money n'est pas branchée. Il « envoie » l'argent instantanément
 * (statut PAID) pour que tout le circuit — retrait automatique, notification, historique du portefeuille — soit testable de bout en
 * bout. AUCUN VRAI VIREMENT n'a lieu.
 *
 * Pour tester un refus : un numéro de destination qui se termine par « 0000 » est refusé (le solde est alors remis au conducteur).
 *
 * ⚠️ À remplacer par l'adaptateur réel avant l'ouverture au public (voir ProductionSafetyService, qui le signale au démarrage).
 */
@Injectable()
export class SimulatedPayoutProvider implements PayoutProvider {
  readonly isSimulated = true;
  private readonly logger = new Logger('SimulatedPayoutProvider');

  async disburse(params: DisburseParams): Promise<DisburseOutcome> {
    if (params.destination.replace(/\D/g, '').endsWith('0000')) {
      this.logger.warn(`[SIMULATION] Retrait ${params.reference} refusé (numéro de test se terminant par 0000).`);
      return { status: 'FAILED', reason: 'Numéro Mobile Money refusé (simulation).' };
    }
    const externalReference = `SIM-${randomUUID()}`;
    this.logger.warn(
      `[SIMULATION] Retrait ${params.reference} de ${params.amount} ${params.currencyIsoCode} vers ${params.destination} « envoyé » (réf. ${externalReference}) — AUCUN VRAI VIREMENT N'A EU LIEU.`,
    );
    return { status: 'PAID', externalReference };
  }
}
