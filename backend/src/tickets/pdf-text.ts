// backend/src/tickets/pdf-text.ts
// [10/10/2026] v1 — petits outils de texte pour les PDF : les polices intégrées de PDF (Helvetica, Courier) ne connaissent que le jeu
// de caractères WinAnsi (français et langues d'Europe de l'Ouest). Un nom saisi avec un caractère hors de ce jeu ne doit ni
// disparaître ni casser le document.

/** Caractères au-delà de U+00FF présents dans WinAnsi (windows-1252) : œ, €, guillemets typographiques, tirets, puce… */
const WIN_ANSI_EXTRAS = new Set('ŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™'.split(''));

/** Remplace ce que la police ne sait pas dessiner par la lettre de base (ɗ → d), à défaut par « ? ». */
export function pdfSafe(text: string | null | undefined): string {
  if (!text) return '';
  let result = '';
  // Les espaces fines de la mise en forme française des nombres (« 235 000 ») ne sont pas dans la police : espace normale.
  for (const char of text.normalize('NFC').replace(/[\u2000-\u200b\u202f\u205f\u3000]/g, ' ')) {
    const code = char.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRAS.has(char)) {
      result += char;
    } else if (code === 0x0a || code === 0x09) {
      result += ' ';
    } else {
      const base = char.normalize('NFD').replace(/[̀-ͯ]/g, '');
      result += base.length > 0 && base.codePointAt(0)! <= 0x7e && base.codePointAt(0)! >= 0x20 ? base : '?';
    }
  }
  return result.trim();
}

/** Première lettre en majuscule de chaque mot — « boubacar BARRY » → « Boubacar Barry ». */
export function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_match, before: string, letter: string) => `${before}${letter.toUpperCase()}`);
}
