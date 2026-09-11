// backend/src/payments/providers/simulated-payment.provider.ts
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentProviderAdapter,
  WebhookParseResult,
} from './payment-provider-adapter.interface';

/**
 * Adaptateur de simulation — utilisé tant qu'aucune intégration réelle
 * (Orange Money, carte...) n'est branchée. Capture immédiatement chaque
 * paiement (immediateStatus: 'CAPTURED') pour que tout le reste du
 * système (confirmation de réservation, crédit du portefeuille chauffeur)
 * soit testable de bout en bout sans dépendre d'un vrai prestataire.
 *
 * ⚠️ Ne jamais utiliser en production : aucune vérification de paiement
 * réel n'a lieu. Remplacer par un adaptateur réel dans
 * PaymentProviderRegistry avant tout lancement commercial (section 14).
 */
@Injectable()
export class SimulatedPaymentProvider implements PaymentProviderAdapter {
  private readonly logger = new Logger('SimulatedPaymentProvider');

  async initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const externalReference = `SIM-${randomUUID()}`;
    this.logger.warn(
      `[SIMULATION] Paiement ${params.paymentId} de ${params.amount} ${params.currencyIsoCode} capturé instantanément (réf. ${externalReference}) — AUCUN VRAI PAIEMENT N'A EU LIEU.`,
    );
    return {
      externalReference,
      instructions: 'Paiement simulé — aucune action réelle requise.',
      immediateStatus: 'CAPTURED',
    };
  }

  async verifyAndParseWebhook(rawPayload: unknown): Promise<WebhookParseResult> {
    const payload = rawPayload as { externalReference?: string; status?: string };
    if (!payload?.externalReference) {
      throw new UnauthorizedException('Webhook de simulation invalide : externalReference manquant.');
    }
    return {
      externalReference: payload.externalReference,
      status: payload.status === 'FAILED' ? 'FAILED' : 'CAPTURED',
    };
  }

  async refund(params: { externalReference: string; amount: bigint }) {
    this.logger.warn(
      `[SIMULATION] Remboursement de ${params.amount} pour ${params.externalReference} — AUCUN VRAI REMBOURSEMENT N'A EU LIEU.`,
    );
    return { externalReference: `SIM-REFUND-${randomUUID()}` };
  }
}
