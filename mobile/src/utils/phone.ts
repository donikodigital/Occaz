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

// ---------------------------------------------------------------------------
// Pays, indicatif et drapeau (inscription, connexion, mot de passe oublié)
// ---------------------------------------------------------------------------

/** « GN » → 🇬🇳. Les drapeaux sont des emojis : rien à télécharger, et ils suivent la langue de l'appareil. */
export function flagEmoji(isoCode: string | null | undefined): string {
  if (!isoCode || !/^[A-Za-z]{2}$/.test(isoCode)) return '🏳️';
  return isoCode.toUpperCase().replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

/** L'indicatif est enregistré avec ou sans « + » selon le pays : on l'affiche toujours avec. */
export function formatDialCode(phoneCode: string | null | undefined): string {
  const digits = (phoneCode ?? '').replace(/[^\d]/g, '');
  return digits ? `+${digits}` : '+';
}

/**
 * Numéro international à partir de l'indicatif du pays et de ce que la personne a tapé.
 *  « 620 00 00 10 »          → « +224620000010 »
 *  « 0620000010 » (zéro initial) → « +224620000010 »
 *  « +33612345678 » (numéro déjà international) → laissé tel quel.
 */
export function buildInternationalPhone(dialCode: string, typed: string): string {
  const trimmed = typed.trim();
  if (trimmed.startsWith('+')) return normalizePhoneInput(trimmed);
  const national = trimmed.replace(/[^\d]/g, '').replace(/^0+/, '');
  return `${formatDialCode(dialCode)}${national}`;
}
