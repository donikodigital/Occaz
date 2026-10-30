// backend/src/i18n/texts/errors-payments.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_PAYMENTS: readonly TextRow[] = [
  ["Ce paiement ne vous appartient pas.", "This payment does not belong to you.", "Este pagamento não lhe pertence."],
  ["Ce moyen de paiement n'est plus disponible.", "This payment method is no longer available.", "Este meio de pagamento já não está disponível."],
  ["Ce paiement a déjà été effectué.", "This payment has already been made.", "Este pagamento já foi efetuado."],
  ["Ce paiement a déjà été remboursé : il ne peut plus être relancé.", "This payment has already been refunded: it can no longer be retried.", "Este pagamento já foi reembolsado: já não pode ser repetido."],
  ["Cette réservation n'est plus à payer (déjà payée, annulée ou expirée).", "This booking no longer needs to be paid (already paid, cancelled or expired).", "Esta reserva já não tem de ser paga (já paga, cancelada ou expirada)."],
  ["Cet envoi n'est plus à payer (déjà payé, annulé ou expiré).", "This shipment no longer needs to be paid (already paid, cancelled or expired).", "Este envio já não tem de ser pago (já pago, cancelado ou expirado)."],
  ["Cette réservation ne vous appartient pas.", "This booking does not belong to you.", "Esta reserva não lhe pertence."],
  ["Cet envoi ne vous appartient pas.", "This shipment does not belong to you.", "Este envio não lhe pertence."],
  ["Transaction introuvable.", "Transaction not found.", "Transação não encontrada."],
  ["Paiement introuvable.", "Payment not found.", "Pagamento não encontrado."],
];
