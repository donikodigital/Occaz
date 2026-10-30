// backend/src/i18n/texts/errors-disputes.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_DISPUTES: readonly TextRow[] = [
  ["Litige introuvable.", "Dispute not found.", "Litígio não encontrado."],
  ["Fournissez exactement un des deux : bookingId ou shipmentId.", "Provide exactly one of the two: bookingId or shipmentId.", "Indique exatamente um dos dois: bookingId ou shipmentId."],
  ["subjectType ne correspond pas à bookingId/shipmentId fourni.", "subjectType does not match the bookingId/shipmentId provided.", "subjectType não corresponde ao bookingId/shipmentId indicado."],
  ["Vous n'êtes pas partie à cette réservation.", "You are not a party to this booking.", "Não faz parte desta reserva."],
  ["Vous n'êtes pas partie à cet envoi.", "You are not a party to this shipment.", "Não faz parte deste envio."],
  ["Accès non autorisé à ce litige.", "Unauthorised access to this dispute.", "Acesso não autorizado a este litígio."],
  ["Utilisez /resolve ou /close pour ces transitions.", "Use /resolve or /close for these transitions.", "Utilize /resolve ou /close para estas transições."],
  ["Ce litige est déjà résolu/clos.", "This dispute is already resolved/closed.", "Este litígio já está resolvido/encerrado."],
  ["Ce litige a déjà une résolution enregistrée.", "This dispute already has a recorded resolution.", "Este litígio já tem uma resolução registada."],
  ["Ce litige vient d'être résolu par quelqu'un d'autre.", "This dispute has just been resolved by someone else.", "Este litígio acabou de ser resolvido por outra pessoa."],
  ["refundAmount est requis pour ce type de résolution.", "refundAmount is required for this type of resolution.", "refundAmount é obrigatório para este tipo de resolução."],
  ["targetUserId est requis pour une SUSPENSION.", "targetUserId is required for a SUSPENSION.", "targetUserId é obrigatório para uma SUSPENSÃO."],
  ["otpPurpose est requis pour ce type de résolution (quelle étape valider : TRIP_PICKUP, TRIP_DROPOFF, SHIPMENT_PICKUP ou SHIPMENT_DELIVERY).", "otpPurpose is required for this type of resolution (which step to validate: TRIP_PICKUP, TRIP_DROPOFF, SHIPMENT_PICKUP or SHIPMENT_DELIVERY).", "otpPurpose é obrigatório para este tipo de resolução (qual o passo a validar: TRIP_PICKUP, TRIP_DROPOFF, SHIPMENT_PICKUP ou SHIPMENT_DELIVERY)."],
  ["Une justification détaillée (10 caractères minimum) est requise pour valider un code manuellement — elle reste tracée dans le litige.", "A detailed justification (at least 10 characters) is required to validate a code manually — it remains recorded in the dispute.", "É necessária uma justificação detalhada (mínimo de 10 caracteres) para validar um código manualmente — fica registada no litígio."],
  ["Cette étape ne correspond pas au type de ce litige (trajet/envoi).", "This step does not match the type of this dispute (trip/shipment).", "Este passo não corresponde ao tipo deste litígio (viagem/envio)."],
  ["Aucun paiement remboursable pour cette prestation — rien à rembourser.", "No refundable payment for this service — nothing to refund.", "Não existe nenhum pagamento reembolsável para este serviço — nada a reembolsar."],
  ["Le montant à rembourser dépasse le montant payé.", "The amount to refund exceeds the amount paid.", "O montante a reembolsar excede o montante pago."],
  ["Rien à rembourser : ce paiement est déjà entièrement remboursé.", "Nothing to refund: this payment has already been fully refunded.", "Nada a reembolsar: este pagamento já foi totalmente reembolsado."],
  ["Seul un litige RESOLVED peut être clos.", "Only a RESOLVED dispute can be closed.", "Só um litígio RESOLVIDO pode ser encerrado."],
];
