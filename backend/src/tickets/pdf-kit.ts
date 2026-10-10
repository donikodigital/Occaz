// backend/src/tickets/pdf-kit.ts
// [10/10/2026] v1 — base commune des PDF A5 : création du document, collecte en mémoire, texte qui s'adapte à la place disponible.
import PDFDocument from 'pdfkit';

/** A5 portrait, en points PDF (1 pt = 1/72 pouce) : 148 × 210 mm. */
export const A5 = { width: 419.53, height: 595.28 } as const;

export const COLORS = {
  deep: '#083A63',
  base: '#0B6BA8',
  bright: '#1E9BD7',
  mist: '#EAF5FB',
  line: '#CFE4F2',
  gold: '#FFD166',
  goldInk: '#8A5A00',
  ink: '#101820',
  muted: '#5B6B79',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type Doc = InstanceType<typeof PDFDocument>;

/** Crée un document A5 sans marge (la mise en page positionne tout à la main) et renvoie une promesse du PDF complet. */
export function createA5Document(info: { title: string; subject: string }): { doc: Doc; done: Promise<Buffer> } {
  const doc = new PDFDocument({
    size: [A5.width, A5.height],
    margin: 0,
    autoFirstPage: true,
    info: { Title: info.title, Subject: info.subject, Author: "Occa'Z", Creator: "Occa'Z" },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  return { doc, done };
}

/**
 * Écrit `text` sur une seule ligne dans `maxWidth`, en réduisant la taille de police jusqu'à `minSize` si nécessaire ; au-delà, le
 * texte est tronqué avec « … » plutôt que de déborder sur le voisin. Renvoie la hauteur de ligne utilisée.
 */
export function fitText(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  options: { font: string; size: number; minSize?: number; color: string; align?: 'left' | 'center' | 'right' },
): number {
  const minSize = options.minSize ?? Math.max(6, Math.round(options.size * 0.5));
  doc.font(options.font);
  let size = options.size;
  while (size > minSize && doc.fontSize(size).widthOfString(text) > maxWidth) size -= 0.5;
  doc.fontSize(size);

  let shown = text;
  if (doc.widthOfString(shown) > maxWidth) {
    while (shown.length > 1 && doc.widthOfString(`${shown}…`) > maxWidth) shown = shown.slice(0, -1);
    shown = `${shown.trimEnd()}…`;
  }
  doc.fillColor(options.color).text(shown, x, y, { width: maxWidth, align: options.align ?? 'left', lineBreak: false });
  return doc.currentLineHeight();
}

/**
 * Texte sur plusieurs lignes, limité à `maxLines` : au-delà, il est raccourci mot à mot et terminé par « … ». Le calcul se fait ici
 * (hauteur mesurée) plutôt qu'avec l'option `height` de pdfkit, qui coupe parfois une ligne de trop. Renvoie la hauteur occupée.
 */
export function paragraph(
  doc: Doc,
  text: string,
  x: number,
  y: number,
  width: number,
  options: { font: string; size: number; color: string; maxLines: number; lineGap?: number; align?: 'left' | 'center' | 'right' },
): number {
  const lineGap = options.lineGap ?? 1;
  doc.font(options.font).fontSize(options.size).fillColor(options.color);
  const oneLine = doc.heightOfString('Ag', { width, lineGap });
  const limit = oneLine * options.maxLines + 0.5;

  let shown = text;
  if (doc.heightOfString(shown, { width, lineGap }) > limit) {
    const words = shown.split(/\s+/);
    while (words.length > 1 && doc.heightOfString(`${words.join(' ')}…`, { width, lineGap }) > limit) words.pop();
    shown = `${words.join(' ')}…`;
    // Un seul mot trop long : on le coupe lettre par lettre.
    while (shown.length > 2 && doc.heightOfString(shown, { width, lineGap }) > limit) shown = `${shown.slice(0, -2)}…`;
  }
  doc.text(shown, x, y, { width, lineGap, align: options.align ?? 'left' });
  return doc.heightOfString(shown, { width, lineGap });
}
