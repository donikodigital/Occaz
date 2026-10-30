// backend/src/i18n/texts/errors-common.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_COMMON: readonly TextRow[] = [
  ["Permission manquante : {0}.", "Missing permission: {0}.", "Permissão em falta: {0}."],
  ["Montant invalide : saisis un nombre entier positif, sans virgule ni signe.", "Invalid amount: enter a positive whole number, with no decimal point or sign.", "Montante inválido: introduza um número inteiro positivo, sem vírgula nem sinal."],
  ["Montant invalide : il est beaucoup trop grand.", "Invalid amount: it is far too large.", "Montante inválido: é demasiado elevado."],
  ["Le montant doit être supérieur à zéro.", "The amount must be greater than zero.", "O montante tem de ser superior a zero."],
];
