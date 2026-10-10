// backend/src/tickets/barcodes.ts
// [10/10/2026] v1 — QR code et code-barres Code 128 en PNG, à poser dans les PDF.
// Typage minimal écrit ici : les définitions de bwip-js varient selon la version et le point d'entrée (navigateur ou Node) ; seule la
// fonction toBuffer (qui rend une promesse de PNG) nous sert.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bwipjs = require('bwip-js') as { toBuffer(options: Record<string, unknown>): Promise<Buffer> };

/** QR code carré. `scale` : pixels par module — grand pour que la réduction dans le PDF reste nette à l'impression. */
export async function qrPng(text: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'qrcode',
    text,
    scale: 8,
    eclevel: 'M',
    paddingwidth: 0,
    paddingheight: 0,
  });
}

/** Code-barres Code 128 sans texte (le numéro est imprimé à part, en gros). Largeur libre, hauteur donnée en millimètres de module. */
export async function code128Png(text: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 4,
    height: 16,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  });
}
