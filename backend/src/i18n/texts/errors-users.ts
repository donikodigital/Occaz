// backend/src/i18n/texts/errors-users.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_USERS: readonly TextRow[] = [
  ["Action non autorisée.", "Action not allowed.", "Ação não permitida."],
  ["Vous ne pouvez pas appliquer cette action à votre propre compte.", "You cannot apply this action to your own account.", "Não pode aplicar esta ação à sua própria conta."],
  ["Seul un SuperAdmin peut gérer les comptes de l'équipe.", "Only a SuperAdmin can manage team accounts.", "Só um SuperAdmin pode gerir as contas da equipa."],
  ["Cet utilisateur n'a pas de profil client ou conducteur à modifier.", "This user has no customer or driver profile to edit.", "Este utilizador não tem perfil de cliente ou de condutor para editar."],
  ["Vous avez une réservation en cours. Attendez sa fin ou annulez-la avant de supprimer votre compte.", "You have a booking in progress. Wait for it to finish or cancel it before deleting your account.", "Tem uma reserva em curso. Aguarde o seu fim ou cancele-a antes de eliminar a sua conta."],
  ["Vous avez un envoi en cours. Attendez sa livraison ou annulez-le avant de supprimer votre compte.", "You have a shipment in progress. Wait for its delivery or cancel it before deleting your account.", "Tem um envio em curso. Aguarde a entrega ou cancele-o antes de eliminar a sua conta."],
  ["Vous avez un trajet en cours en tant que conducteur. Terminez-le ou annulez-le avant de supprimer votre compte.", "You have a trip in progress as a driver. Finish it or cancel it before deleting your account.", "Tem uma viagem em curso como condutor. Termine-a ou cancele-a antes de eliminar a sua conta."],
];
