// mobile/src/utils/phone.ts
/**
 * Format international requis par le backend (IsPhoneNumber côté
 * AuthController, Lot 1) — validation simple côté client pour un retour
 * immédiat, la validation faisant foi reste toujours côté serveur.
 */
export function isValidPhoneNumber(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

/** Normalise une saisie libre en gardant uniquement le "+" et les chiffres. */
export function normalizePhoneInput(value: string): string {
  const cleaned = value.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned.replace(/\+/g, '')}`;
}
