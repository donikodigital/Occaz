// backend/src/common/utils/amount-in-words.ts
// [25/10/2026] v1 — Montant en toutes lettres, en français (« deux cent quinze mille neuf cent quatre-vingt-dix-huit »), pour les pièces
// comptables : « Arrêté la présente facture à la somme de … ». Règles suivies : « et un » (21, 31…, 71), « quatre-vingts » et « cents »
// prennent un s seulement quand rien ne les suit (ou devant « million », « milliard »), « mille » ne change jamais, pas de « un » devant « mille ».

const SMALL = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

/** 0 à 19 (dix-sept, dix-huit, dix-neuf compris). */
function underTwenty(n: number): string {
  return n <= 16 ? SMALL[n] : `dix-${SMALL[n - 10]}`;
}

/** 1 à 99. `final` : rien ne suit le nombre, « quatre-vingts » prend son s. */
function underHundred(n: number, final: boolean): string {
  if (n < 20) return underTwenty(n);
  if (n < 70) {
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    if (unit === 0) return TENS[tens];
    return unit === 1 ? `${TENS[tens]} et un` : `${TENS[tens]}-${SMALL[unit]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${underTwenty(n - 60)}`;
  if (n === 80) return final ? 'quatre-vingts' : 'quatre-vingt';
  return `quatre-vingt-${underTwenty(n - 80)}`;
}

/** 1 à 999. */
function underThousand(n: number, final: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds === 1) parts.push('cent');
  else if (hundreds > 1) parts.push(`${SMALL[hundreds]} cent${rest === 0 && final ? 's' : ''}`);
  if (rest > 0) parts.push(underHundred(rest, final));
  return parts.join(' ');
}

const SCALES = ['', 'mille', 'million', 'milliard', 'billion'];

/** Entier positif ou nul (moins de 10^15) en lettres, en minuscules. */
export function amountInWords(value: bigint | number | string): string {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  if (n < 0n) throw new RangeError('Un montant négatif ne s\'écrit pas en lettres.');
  if (n === 0n) return 'zéro';
  if (n >= 10n ** 15n) throw new RangeError('Montant trop grand pour être écrit en lettres.');

  const groups: number[] = [];
  let rest = n;
  while (rest > 0n) {
    groups.push(Number(rest % 1000n));
    rest /= 1000n;
  }

  const parts: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (group === 0) continue;
    if (index === 0) {
      parts.push(underThousand(group, true));
    } else if (index === 1) {
      // « mille » ne prend ni « un » ni s, et ce qui le précède non plus (deux cent mille, quatre-vingt mille).
      parts.push(group === 1 ? 'mille' : `${underThousand(group, false)} mille`);
    } else {
      // « million », « milliard » sont des noms : ils prennent un s au pluriel, et ce qui les précède aussi (deux cents millions).
      parts.push(`${underThousand(group, true)} ${SCALES[index]}${group > 1 ? 's' : ''}`);
    }
  }
  return parts.join(' ');
}

/** « Deux cent quinze mille francs guinéens » : première lettre en majuscule. */
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
