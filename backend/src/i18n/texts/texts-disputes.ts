// backend/src/i18n/texts/texts-disputes.ts
// [30/10/2026] v1 — Textes traduits (notifications, e-mails, SMS, PDF) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const TEXTS_DISPUTES: readonly TextRow[] = [
  ["Annulation décidée suite à un litige", "Cancellation decided following a dispute", "Cancelamento decidido na sequência de um litígio"],
  ["Suspendu suite à résolution de litige.", "Suspended following a dispute resolution.", "Suspenso na sequência da resolução de um litígio."],
  ["Le support", "Support", "Suporte"],
  ["Colis non reçu", "Parcel not received", "Encomenda não recebida"],
  ["Utilisateur supprimé", "Deleted user", "Utilizador eliminado"],
  ["[message supprimé]", "[message deleted]", "[mensagem eliminada]"],
  ["Annulé par le conducteur", "Cancelled by the driver", "Cancelado pelo condutor"],
  ["Annulée par la personne.", "Cancelled by the person.", "Cancelado pela pessoa."],
];
