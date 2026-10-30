// backend/src/i18n/texts/errors-otp.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_OTP: readonly TextRow[] = [
  ["Ce code a déjà été utilisé — demandez-en un nouveau.", "This code has already been used — request a new one.", "Este código já foi utilizado — peça um novo."],
  ["Trop d’essais incorrects pour cette étape. Par sécurité, la saisie est bloquée pendant une heure. Si le client est bien présent, contactez le support.", "Too many incorrect attempts for this step. For security, entry is blocked for one hour. If the customer is really present, contact support.", "Demasiadas tentativas incorretas para este passo. Por segurança, a introdução fica bloqueada durante uma hora. Se o cliente estiver realmente presente, contacte o suporte."],
];
