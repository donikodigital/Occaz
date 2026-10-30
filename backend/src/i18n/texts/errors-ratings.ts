// backend/src/i18n/texts/errors-ratings.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_RATINGS: readonly TextRow[] = [
  ["Accès non autorisé à ces notations.", "Unauthorised access to these ratings.", "Acesso não autorizado a estas avaliações."],
  ["Seule une réservation terminée peut être notée.", "Only a completed booking can be rated.", "Só uma reserva concluída pode ser avaliada."],
  ["Seul un envoi terminé peut être noté.", "Only a completed shipment can be rated.", "Só um envio concluído pode ser avaliado."],
  ["Aucun conducteur associé à cet envoi.", "No driver is associated with this shipment.", "Nenhum condutor está associado a este envio."],
  ["Vous ne pouvez pas vous noter vous-même.", "You cannot rate yourself.", "Não pode avaliar-se a si próprio."],
  ["Vous n'êtes ni le client ni le conducteur de cette prestation.", "You are neither the customer nor the driver of this service.", "Não é nem o cliente nem o condutor deste serviço."],
  ["Cette prestation a déjà été notée.", "This service has already been rated.", "Este serviço já foi avaliado."],
];
