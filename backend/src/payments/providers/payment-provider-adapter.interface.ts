// backend/src/payments/providers/payment-provider-adapter.interface.ts
/**
 * Contrat commun à tous les prestataires de paiement — même principe que
 * SmsProvider (Lot 1) et exactement l'architecture PaymentService
 * décrite section 14 du cahier des charges :
 *
 *   PaymentService
 *     |- OrangeMoneyProvider
 *     |- MobileMoneyProvider
 *     |- XOFProvider
 *     |- FutureProvider
 *
 * Aucun module métier (Bookings, Shipments) ne parle jamais à un SDK de
 * prestataire — uniquement à PaymentsService, qui délègue à l'adaptateur
 * choisi via PaymentProviderRegistry.
 */

export interface InitiatePaymentParams {
  paymentId: string;
  amount: bigint;
  currencyIsoCode: string;
  customerPhone?: string;
}

export interface InitiatePaymentResult {
  externalReference: string;
  /** Présent pour les prestataires nécessitant une redirection (carte, certains mobile money). */
  redirectUrl?: string;
  /** Message à afficher au client (ex: "Composez #144# pour valider"). */
  instructions?: string;
  /**
   * Réservé aux adaptateurs de simulation/développement : statut déjà
   * connu sans attendre de webhook asynchrone. Un vrai prestataire ne
   * renseigne jamais ce champ — la confirmation arrive uniquement via
   * verifyAndParseWebhook, jamais depuis la réponse d'initiation
   * (règle d'or, section 13).
   */
  immediateStatus?: 'CAPTURED' | 'FAILED';
}

export interface WebhookParseResult {
  externalReference: string;
  status: 'CAPTURED' | 'FAILED';
}

export interface RefundResult {
  externalReference: string;
}

export interface PaymentProviderAdapter {
  initiate(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;

  /**
   * Vérifie l'authenticité du webhook (signature/secret propre au
   * prestataire) puis en extrait le résultat. Doit lever une exception
   * si la vérification échoue — ne jamais faire confiance à un payload
   * non authentifié.
   */
  verifyAndParseWebhook(rawPayload: unknown, headers: Record<string, string>): Promise<WebhookParseResult>;

  refund(params: { externalReference: string; amount: bigint }): Promise<RefundResult>;
}
