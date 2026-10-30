// backend/src/i18n/texts/texts-payments.ts
// [30/10/2026] v1 — Textes traduits (notifications, e-mails, SMS, PDF) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const TEXTS_PAYMENTS: readonly TextRow[] = [
  ["la réservation {0}", "booking {0}", "a reserva {0}"],
  ["1 place réservée sur votre trajet {0} → {1}.", "1 seat booked on your trip {0} → {1}.", "1 lugar reservado na sua viagem {0} → {1}."],
  ["{0} places réservées sur votre trajet {1} → {2}.", "{0} seats booked on your trip {1} → {2}.", "{0} lugares reservados na sua viagem {1} → {2}."],
  ["Remboursement intégral du client", "Full refund to the customer", "Reembolso integral ao cliente"],
  ["Remboursement partiel du client", "Partial refund to the customer", "Reembolso parcial ao cliente"],
  ["Récompense de parrainage automatique (référence {0})", "Automatic referral reward (reference {0})", "Recompensa de apadrinhamento automática (referência {0})"],
  ["Récompense de parrainage (référence {0})", "Referral reward (reference {0})", "Recompensa de apadrinhamento (referência {0})"],
  ["votre compte Mobile Money", "your Mobile Money account", "a sua conta Mobile Money"],
  ["raison non précisée", "no reason given", "motivo não especificado"],
  ["non précisé", "not specified", "não especificado"],
  ["Par sécurité, votre retrait de {0} vers {1} (nouveau numéro) sera envoyé automatiquement dans {2} minute. Ce n'est pas vous ? Annulez-le tout de suite depuis votre historique de retraits.", "For your security, your withdrawal of {0} to {1} (new number) will be sent automatically in {2} minute. Not you? Cancel it right away from your withdrawal history.", "Por segurança, o seu levantamento de {0} para {1} (novo número) será enviado automaticamente dentro de {2} minuto. Não foi você? Cancele-o já a partir do seu histórico de levantamentos."],
  ["Par sécurité, votre retrait de {0} vers {1} (nouveau numéro) sera envoyé automatiquement dans {2} minutes. Ce n'est pas vous ? Annulez-le tout de suite depuis votre historique de retraits.", "For your security, your withdrawal of {0} to {1} (new number) will be sent automatically in {2} minutes. Not you? Cancel it right away from your withdrawal history.", "Por segurança, o seu levantamento de {0} para {1} (novo número) será enviado automaticamente dentro de {2} minutos. Não foi você? Cancele-o já a partir do seu histórico de levantamentos."],
];
