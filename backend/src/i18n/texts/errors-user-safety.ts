// backend/src/i18n/texts/errors-user-safety.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_USER_SAFETY: readonly TextRow[] = [
  ["Choisissez le numéro d’un proche, pas le vôtre.", "Choose a close contact’s number, not your own.", "Escolha o número de uma pessoa próxima, não o seu."],
  ["Vous pouvez enregistrer {0} proches au plus.", "You can save at most {0} close contacts.", "Pode guardar no máximo {0} pessoas próximas."],
  ["Ce numéro est déjà dans votre liste.", "This number is already in your list.", "Este número já está na sua lista."],
  ["Proche introuvable.", "Close contact not found.", "Pessoa próxima não encontrada."],
  ["Latitude et longitude vont ensemble.", "Latitude and longitude go together.", "A latitude e a longitude têm de ser indicadas em conjunto."],
  ["Alerte introuvable ou déjà terminée.", "Alert not found or already ended.", "Alerta não encontrado ou já terminado."],
  ["Alerte introuvable.", "Alert not found.", "Alerta não encontrado."],
  ["Cette alerte a été annulée par la personne.", "This alert was cancelled by the person.", "Este alerta foi cancelado pela própria pessoa."],
  ["Indiquez la personne concernée (userId, driverId ou customerId — un seul).", "Specify the person concerned (userId, driverId or customerId — only one).", "Indique a pessoa em causa (userId, driverId ou customerId — apenas um)."],
  ["Vous ne pouvez pas vous bloquer vous-même.", "You cannot block yourself.", "Não pode bloquear-se a si próprio."],
  ["Ce compte ne peut pas être bloqué.", "This account cannot be blocked.", "Esta conta não pode ser bloqueada."],
  ["Vous ne pouvez pas vous signaler vous-même.", "You cannot report yourself.", "Não pode denunciar-se a si próprio."],
  ["Ce compte ne peut pas être signalé ici. Contactez le support depuis l'aide.", "This account cannot be reported here. Contact support from the help section.", "Esta conta não pode ser denunciada aqui. Contacte o suporte a partir da ajuda."],
  ["Vous avez atteint le nombre maximal de signalements pour aujourd'hui.", "You have reached the maximum number of reports for today.", "Atingiu o número máximo de denúncias para hoje."],
  ["Signalement introuvable.", "Report not found.", "Denúncia não encontrada."],
  ["Le message est trop court.", "The message is too short.", "A mensagem é demasiado curta."],
];
