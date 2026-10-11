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
 * Le zéro initial est le préfixe d'appel national (à retirer) sauf dans les pays où il fait partie du numéro (Côte d'Ivoire, Bénin).
 */
export function buildInternationalPhone(dialCode: string, typed: string, isoCode?: string | null): string {
  const trimmed = typed.trim();
  if (trimmed.startsWith('+')) return normalizePhoneInput(trimmed);
  const digits = trimmed.replace(/[^\d]/g, '');
  const national = keepsLeadingZero(isoCode) ? digits : digits.replace(/^0+/, '');
  return `${formatDialCode(dialCode)}${national}`;
}

// ---------------------------------------------------------------------------
// Saisie guidée du numéro : des espaces au bon endroit selon le pays
//   Guinée  : 622 34 32 34        Sénégal : 77 509 99 95
// ---------------------------------------------------------------------------

/** Groupes de chiffres du numéro national, par pays (code ISO). Pays absent de la table : groupes de 3. */
const NATIONAL_GROUPS: Record<string, number[]> = {
  GN: [3, 2, 2, 2], // Guinée     622 34 32 34
  SN: [2, 3, 2, 2], // Sénégal    77 509 99 95
  ML: [2, 2, 2, 2], // Mali
  BF: [2, 2, 2, 2], // Burkina Faso
  TG: [2, 2, 2, 2], // Togo
  NE: [2, 2, 2, 2], // Niger
  CI: [2, 2, 2, 2, 2], // Côte d'Ivoire (10 chiffres, le 0 initial fait partie du numéro)
  BJ: [2, 2, 2, 2, 2], // Bénin (10 chiffres, idem)
  GW: [3, 3, 3], // Guinée-Bissau
  FR: [1, 2, 2, 2, 2], // France     6 12 34 56 78
};
const DEFAULT_GROUPS = [3, 3, 3, 3];

function groupsFor(isoCode: string | null | undefined): number[] {
  return NATIONAL_GROUPS[(isoCode ?? '').toUpperCase()] ?? DEFAULT_GROUPS;
}

function keepsLeadingZero(isoCode: string | null | undefined): boolean {
  const code = (isoCode ?? '').toUpperCase();
  return code === 'CI' || code === 'BJ';
}

/**
 * Met en forme ce que la personne tape : chiffres seulement, zéro d'appel national retiré, longueur limitée au numéro du pays, espaces
 * insérés entre les groupes. « 622343234 » → « 622 34 32 34 » (Guinée) ; « 775099995 » → « 77 509 99 95 » (Sénégal).
 */
export function formatNationalPhone(isoCode: string | null | undefined, input: string): string {
  let digits = input.replace(/[^\d]/g, '');
  if (!keepsLeadingZero(isoCode)) digits = digits.replace(/^0+/, '');
  const groups = groupsFor(isoCode);
  digits = digits.slice(0, groups.reduce((sum, size) => sum + size, 0));

  const parts: string[] = [];
  let cursor = 0;
  for (const size of groups) {
    if (cursor >= digits.length) break;
    parts.push(digits.slice(cursor, cursor + size));
    cursor += size;
  }
  return parts.join(' ');
}

/** Exemple affiché dans le champ vide : « 620 00 00 00 » (Guinée), « 77 000 00 00 » (Sénégal)… */
export function phonePlaceholder(isoCode: string | null | undefined): string {
  const total = groupsFor(isoCode).reduce((sum, size) => sum + size, 0);
  const lead = (isoCode ?? '').toUpperCase() === 'GN' ? '62' : (isoCode ?? '').toUpperCase() === 'SN' ? '77' : '';
  return formatNationalPhone(isoCode, `${lead}${'0'.repeat(Math.max(0, total))}`.slice(0, total) || '0');
}

/**
 * Saisie dans le champ téléphone d'un pays déjà choisi : un numéro collé avec son indicatif (« +224622343234 ») est ramené à sa partie
 * nationale ; sinon on met en forme. Un numéro international d'un AUTRE pays est laissé tel quel (avec son « + »).
 */
export function formatPhoneTyping(country: { isoCode: string; phoneCode: string } | null, input: string): string {
  if (input.trim().startsWith('+')) {
    const digits = input.replace(/[^\d]/g, '');
    const dial = formatDialCode(country?.phoneCode).slice(1);
    if (country && dial && digits.startsWith(dial)) return formatNationalPhone(country.isoCode, digits.slice(dial.length));
    return normalizePhoneInput(input);
  }
  return formatNationalPhone(country?.isoCode, input);
}

/**
 * Sépare un numéro international (« +224622343234 ») en pays (reconnu par son indicatif, le plus long qui correspond) et numéro national
 * mis en forme (« 622 34 32 34 »). Sert à préremplir les écrans quand on connaît déjà le numéro.
 */
export function splitInternationalPhone<C extends { isoCode: string; phoneCode: string }>(
  countries: C[],
  international: string,
): { country: C; national: string } | null {
  const digits = international.replace(/[^\d]/g, '');
  const match = countries
    .map((country) => ({ country, dial: formatDialCode(country.phoneCode).slice(1) }))
    .filter(({ dial }) => dial.length > 0 && digits.startsWith(dial))
    .sort((a, b) => b.dial.length - a.dial.length)[0];
  if (!match) return null;
  return { country: match.country, national: formatNationalPhone(match.country.isoCode, digits.slice(match.dial.length)) };
}

/** « +224622343234 » → « +224 622 34 32 34 » (affichage). Pays inconnu : le numéro tel quel. */
export function formatInternationalPhone<C extends { isoCode: string; phoneCode: string }>(countries: C[] | undefined, international: string): string {
  const split = splitInternationalPhone(countries ?? [], international);
  return split ? `${formatDialCode(split.country.phoneCode)} ${split.national}` : international;
}
