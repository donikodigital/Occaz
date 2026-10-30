// backend/src/i18n/texts/errors-conversations.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_CONVERSATIONS: readonly TextRow[] = [
  ["Réservation introuvable.", "Booking not found.", "Reserva não encontrada."],
  ["Envoi introuvable.", "Shipment not found.", "Envio não encontrado."],
  ["Aucun conducteur n'est encore assigné à cet envoi.", "No driver has been assigned to this shipment yet.", "Ainda não foi atribuído nenhum condutor a este envio."],
  ["Vous n'êtes pas partie à cette conversation.", "You are not a party to this conversation.", "Não faz parte desta conversa."],
  ["Conversation introuvable.", "Conversation not found.", "Conversa não encontrada."],
  ["Cette conversation est fermée : la prestation est terminée. En cas de problème, utilisez « Signaler un problème ».", "This conversation is closed: the service is complete. If there is a problem, use “Report a problem”.", "Esta conversa está encerrada: o serviço terminou. Em caso de problema, utilize «Comunicar um problema»."],
];
