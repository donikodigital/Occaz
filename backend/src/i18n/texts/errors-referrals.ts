// backend/src/i18n/texts/errors-referrals.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_REFERRALS: readonly TextRow[] = [
  ["Impossible de générer un code de parrainage — réessayez.", "Unable to generate a referral code — try again.", "Não foi possível gerar um código de apadrinhamento — tente novamente."],
  ["Code de parrainage introuvable.", "Referral code not found.", "Código de apadrinhamento não encontrado."],
  ["Vous ne pouvez pas utiliser votre propre code.", "You cannot use your own code.", "Não pode utilizar o seu próprio código."],
  ["Un code de parrainage a déjà été utilisé pour ce compte.", "A referral code has already been used for this account.", "Já foi utilizado um código de apadrinhamento nesta conta."],
  ["Parrainage introuvable.", "Referral not found.", "Apadrinhamento não encontrado."],
  ["Ce parrainage a déjà été validé.", "This referral has already been validated.", "Este apadrinhamento já foi validado."],
];
