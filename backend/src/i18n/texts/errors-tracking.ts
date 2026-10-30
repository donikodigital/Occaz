// backend/src/i18n/texts/errors-tracking.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_TRACKING: readonly TextRow[] = [
  ["Ce numéro de suivi n'est pas valide. Il commence par OCZ, suivi de 10 caractères.", "This tracking number is not valid. It starts with OCZ, followed by 10 characters.", "Este número de seguimento não é válido. Começa por OCZ, seguido de 10 carateres."],
  ["Aucun colis ne correspond à ce numéro.", "No parcel matches this number.", "Nenhuma encomenda corresponde a este número."],
];
