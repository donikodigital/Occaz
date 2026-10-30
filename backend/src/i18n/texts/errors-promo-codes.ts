// backend/src/i18n/texts/errors-promo-codes.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_PROMO_CODES: readonly TextRow[] = [
  ["Code promo introuvable.", "Promo code not found.", "Código promocional não encontrado."],
  ["Montant minimum de {0} requis pour ce code.", "A minimum amount of {0} is required for this code.", "É necessário um montante mínimo de {0} para este código."],
  ["Vous avez déjà utilisé ce code le nombre maximum de fois autorisé.", "You have already used this code the maximum number of times allowed.", "Já utilizou este código o número máximo de vezes permitido."],
  ["Ce code promo n'a plus d'utilisations disponibles.", "This promo code has no uses left.", "Este código promocional já não tem utilizações disponíveis."],
  ["Code promo introuvable ou inactif.", "Promo code not found or inactive.", "Código promocional não encontrado ou inativo."],
  ["Ce code n'est pas encore actif.", "This code is not active yet.", "Este código ainda não está ativo."],
  ["Ce code a expiré.", "This code has expired.", "Este código expirou."],
  ["Ce code ne s'applique pas à ce type de prestation.", "This code does not apply to this type of service.", "Este código não se aplica a este tipo de serviço."],
  ["Ce code n'est pas valable dans ce pays.", "This code is not valid in this country.", "Este código não é válido neste país."],
];
