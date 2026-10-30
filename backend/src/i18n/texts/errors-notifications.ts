// backend/src/i18n/texts/errors-notifications.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_NOTIFICATIONS: readonly TextRow[] = [
  ["L'utilisateur n'a pas d'adresse email.", "The user has no e-mail address.", "O utilizador não tem endereço de e-mail."],
  ["Plafond quotidien de SMS de notification atteint ({0}) — SMS non envoyé.", "Daily notification SMS limit reached ({0}) — SMS not sent.", "Limite diário de SMS de notificação atingido ({0}) — SMS não enviado."],
  ["Notification introuvable.", "Notification not found.", "Notificação não encontrada."],
];
