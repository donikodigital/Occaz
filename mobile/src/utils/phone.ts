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

/** Indicatifs des pays où l'app est disponible — sert à pré-remplir « +224 » (ou « +221 »…) pour un nouveau numéro du même pays. */
const COUNTRY_PREFIXES = ['+224', '+221', '+225', '+223', '+226', '+227', '+228', '+229', '+245'];

/** Indicatif du pays d'un numéro international (« +224620000000 » → « +224 ») ; « + » seul si on ne le reconnaît pas. */
export function guessCountryPrefix(phone: string | null | undefined): string {
  const normalized = (phone ?? '').trim();
  return COUNTRY_PREFIXES.find((prefix) => normalized.startsWith(prefix)) ?? '+';
}
