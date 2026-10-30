// backend/src/i18n/texts/texts-sos.ts
// [30/10/2026] v1 — Textes traduits (notifications, e-mails, SMS, PDF) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const TEXTS_SOS: readonly TextRow[] = [
  ["[Occa'Z] ALERTE SOS : {0} a besoin d'aide{1}. Appelez-le/la au {2}.{3}", "[Occa'Z] SOS ALERT: {0} needs help{1}. Call them on {2}.{3}", "[Occa'Z] ALERTA SOS: {0} precisa de ajuda{1}. Ligue-lhe para o {2}.{3}"],
  [" Position : {0}", " Location: {0}", " Localização: {0}"],
  ["[Occa'Z] Fausse alerte : {0} est en sécurité. Merci de votre réactivité.", "[Occa'Z] False alarm: {0} is safe. Thank you for your quick response.", "[Occa'Z] Falso alarme: {0} está em segurança. Obrigado pela sua rapidez."],
  ["votre proche", "your loved one", "a sua pessoa próxima"],
  ["Harcèlement ou propos déplacés", "Harassment or inappropriate remarks", "Assédio ou comentários inapropriados"],
  ["Comportement dangereux", "Dangerous behaviour", "Comportamento perigoso"],
  ["Fraude ou arnaque", "Fraud or scam", "Fraude ou burla"],
  ["Absence au rendez-vous", "No-show at the meeting point", "Ausência no ponto de encontro"],
  ["Faux profil", "Fake profile", "Perfil falso"],
  ["Contenu inapproprié", "Inappropriate content", "Conteúdo inapropriado"],
  ["Autre motif", "Other reason", "Outro motivo"],
  ["Cette action n'est pas possible avec cet utilisateur.", "This action is not possible with this user.", "Esta ação não é possível com este utilizador."],
];
