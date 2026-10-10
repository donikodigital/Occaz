// backend/src/tickets/parcel-label.pdf.ts
// [10/10/2026] v1 — Étiquettes de colis PDF A5 (portrait), UNE PAGE PAR COLIS, à coller sur le colis : sobre, noir et blanc (lisible sur
// n'importe quelle imprimante), grosse ville de destination, numéro de suivi en grand, code-barres Code 128 et QR code. Le numéro de
// colis (2/3) saute aux yeux : un conducteur qui transporte plusieurs colis ne les mélange pas.
import { A5, COLORS, createA5Document, fitText, paragraph, type Doc } from './pdf-kit';
import { code128Png, qrPng } from './barcodes';
import { pdfSafe } from './pdf-text';

export interface ParcelLabelData {
  /** Numéro de suivi de CE colis, ex. « OCZ7F3A91C2B0-02 » — celui du code-barres. */
  trackingNumber: string;
  /** Numéro de suivi de l'envoi mis en forme, ex. « OCZ 7F3A 91C2 B0 ». */
  displayTracking: string;
  parcelNumber: number;
  parcelCount: number;
  qrPayload: string;
  isUrgent: boolean;
  senderName: string;
  senderPlace: string;
  recipientName: string;
  recipientPhone: string | null;
  /** Adresse de livraison saisie (libellé). */
  recipientAddress: string;
  recipientCity: string;
  recipientCountry: string | null;
  weightKg: number | null;
  /** « 40 × 30 × 20 » — déjà formaté, ou null. */
  dimensions: string | null;
  /** « 200 000 GNF » — déjà formaté, ou null. */
  declaredValue: string | null;
  description: string | null;
  category: string | null;
  /** Fin de la période pendant laquelle le colis peut partir. */
  windowEnd: Date;
  timeZone: string;
}

export interface ParcelLabelsInput {
  title: string;
  labels: ParcelLabelData[];
}

const LEFT = 14;
const TOP = 14;
const WIDTH = A5.width - 2 * LEFT;
const RIGHT = LEFT + WIDTH;
const BOTTOM = A5.height - 14;
const PAD = 12;
const RULE = 2;

function tiny(doc: Doc, text: string, x: number, y: number, color: string = COLORS.black, width = 200) {
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(color).text(text, x, y, { width, characterSpacing: 0.9, lineBreak: false });
}

function hRule(doc: Doc, y: number) {
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).lineWidth(RULE).strokeColor(COLORS.black).stroke();
}

function formatKg(weight: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(weight)} kg`;
}

function formatDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }).format(date);
}

async function drawLabel(doc: Doc, data: ParcelLabelData) {
  const [barcode, qr] = await Promise.all([code128Png(data.trackingNumber), qrPng(data.qrPayload)]);

  // Cadre extérieur épais, comme une étiquette de transporteur.
  doc.rect(LEFT, TOP, WIDTH, BOTTOM - TOP).lineWidth(3).strokeColor(COLORS.black).stroke();

  // --- 1. Marque et service ---
  const row1 = { top: TOP, bottom: TOP + 62 };
  doc.font('Helvetica-Bold').fontSize(30).fillColor(COLORS.black).text("Occa'Z", LEFT + PAD, row1.top + 9, { lineBreak: false });
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.black).text('Transport partagé de colis', LEFT + PAD, row1.top + 46, { lineBreak: false });
  const serviceX = RIGHT - 160;
  doc.rect(serviceX, row1.top + 1.5, RIGHT - serviceX - 1.5, row1.bottom - row1.top - 1.5).fill(COLORS.black);
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.white).text('SERVICE', serviceX, row1.top + 11, {
    width: RIGHT - serviceX,
    align: 'center',
    characterSpacing: 0.9,
    lineBreak: false,
  });
  doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.white).text(data.isUrgent ? 'URGENT' : 'STANDARD', serviceX, row1.top + 25, {
    width: RIGHT - serviceX,
    align: 'center',
    characterSpacing: 1,
    lineBreak: false,
  });
  hRule(doc, row1.bottom);

  // --- 2. Numéro du colis, poids, dimensions, valeur ---
  const row2 = { top: row1.bottom, bottom: row1.bottom + 74 };
  const dividerX = LEFT + 140;
  tiny(doc, 'COLIS', LEFT + PAD, row2.top + 9);
  fitText(doc, `${data.parcelNumber}/${data.parcelCount}`, LEFT + PAD, row2.top + 20, dividerX - LEFT - 2 * PAD, {
    font: 'Helvetica-Bold',
    size: 46,
    minSize: 24,
    color: COLORS.black,
  });
  doc.moveTo(dividerX, row2.top).lineTo(dividerX, row2.bottom).lineWidth(RULE).strokeColor(COLORS.black).stroke();

  const gridX = dividerX + PAD;
  const gridW = (RIGHT - gridX - PAD - 8) / 2;
  const gridX2 = gridX + gridW + 8;
  tiny(doc, 'POIDS', gridX, row2.top + 9, COLORS.black, gridW);
  fitText(doc, data.weightKg ? formatKg(data.weightKg) : '—', gridX, row2.top + 20, gridW, { font: 'Helvetica-Bold', size: 16, minSize: 9, color: COLORS.black });
  tiny(doc, 'DIMENSIONS (CM)', gridX2, row2.top + 9, COLORS.black, gridW);
  fitText(doc, pdfSafe(data.dimensions) || '—', gridX2, row2.top + 20, gridW, { font: 'Helvetica-Bold', size: 13, minSize: 8, color: COLORS.black });
  tiny(doc, 'CATÉGORIE', gridX, row2.top + 43, COLORS.black, gridW);
  fitText(doc, pdfSafe(data.category) || '—', gridX, row2.top + 54, gridW, { font: 'Helvetica-Bold', size: 10, minSize: 7, color: COLORS.black });
  tiny(doc, 'VALEUR DÉCLARÉE', gridX2, row2.top + 43, COLORS.black, gridW);
  fitText(doc, pdfSafe(data.declaredValue) || '—', gridX2, row2.top + 54, gridW, { font: 'Helvetica-Bold', size: 10, minSize: 7, color: COLORS.black });
  hRule(doc, row2.bottom);

  // --- 3. Expéditeur ---
  const row3 = { top: row2.bottom, bottom: row2.bottom + 50 };
  tiny(doc, 'EXPÉDITEUR', LEFT + PAD, row3.top + 8);
  fitText(doc, pdfSafe(data.senderName), LEFT + PAD, row3.top + 19, WIDTH - 2 * PAD, { font: 'Helvetica-Bold', size: 12, minSize: 8, color: COLORS.black });
  fitText(doc, pdfSafe(data.senderPlace), LEFT + PAD, row3.top + 34, WIDTH - 2 * PAD, { font: 'Helvetica', size: 9, minSize: 7, color: COLORS.black });
  hRule(doc, row3.bottom);

  // --- 4. Destinataire ---
  const row4 = { top: row3.bottom, bottom: row3.bottom + 128 };
  tiny(doc, 'LIVRER À', LEFT + PAD, row4.top + 9);
  fitText(doc, pdfSafe(data.recipientName), LEFT + PAD, row4.top + 22, WIDTH - 2 * PAD, { font: 'Helvetica-Bold', size: 22, minSize: 11, color: COLORS.black });
  paragraph(doc, pdfSafe(data.recipientAddress), LEFT + PAD, row4.top + 52, WIDTH - 2 * PAD, {
    font: 'Helvetica',
    size: 12,
    color: COLORS.black,
    maxLines: 3,
    lineGap: 2,
  });
  if (data.recipientPhone) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.black).text(`Tél. ${pdfSafe(data.recipientPhone)}`, LEFT + PAD, row4.bottom - 24, { lineBreak: false });
  }
  hRule(doc, row4.bottom);

  // --- 5. Ville de destination en très grand, texte blanc sur fond noir ---
  const row5 = { top: row4.bottom, bottom: row4.bottom + 66 };
  doc.rect(LEFT + 1.5, row5.top, WIDTH - 3, row5.bottom - row5.top).fill(COLORS.black);
  fitText(doc, pdfSafe(data.recipientCity).toUpperCase(), LEFT + PAD, row5.top + 10, WIDTH - 2 * PAD, {
    font: 'Helvetica-Bold',
    size: 38,
    minSize: 18,
    color: COLORS.white,
    align: 'center',
  });
  if (data.recipientCountry) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.white).text(pdfSafe(data.recipientCountry).toUpperCase(), LEFT + PAD, row5.bottom - 17, {
      width: WIDTH - 2 * PAD,
      align: 'center',
      characterSpacing: 2,
      lineBreak: false,
    });
  }

  // --- 6. Suivi : numéro, code-barres, QR code, infos ---
  tiny(doc, 'N° DE SUIVI', LEFT + PAD, row5.bottom + 9);
  doc.font('Courier-Bold').fontSize(15).fillColor(COLORS.black).text(`${data.displayTracking}-${String(data.parcelNumber).padStart(2, '0')}`, LEFT + PAD, row5.bottom + 19, {
    lineBreak: false,
  });
  const barcodeTop = row5.bottom + 40;
  doc.image(barcode, LEFT + PAD, barcodeTop, { width: WIDTH - 2 * PAD, height: 62 });

  const infoTop = barcodeTop + 62 + 10;
  const qrSize = 58;
  const qrX = RIGHT - PAD - qrSize;
  const infoW = qrX - (LEFT + PAD) - 12;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.black).text(`À faire partir avant le ${formatDay(data.windowEnd, data.timeZone)}`, LEFT + PAD, infoTop, {
    width: infoW,
    lineBreak: false,
  });
  if (data.description) {
    paragraph(doc, `Contenu : ${pdfSafe(data.description)}`, LEFT + PAD, infoTop + 13, infoW, { font: 'Helvetica', size: 8, color: COLORS.black, maxLines: 2 });
  }
  doc.image(qr, qrX, infoTop - 2, { width: qrSize, height: qrSize });
  doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.black).text('À coller sur le colis · ne pas masquer le code-barres', LEFT + PAD, BOTTOM - 15, {
    width: WIDTH - 2 * PAD,
    align: 'center',
    lineBreak: false,
  });
}

/** Un PDF A5 de N pages : une étiquette par colis, dans l'ordre. */
export async function renderParcelLabels(input: ParcelLabelsInput): Promise<Buffer> {
  const { doc, done } = createA5Document({ title: input.title, subject: 'Étiquettes de colis' });
  for (let index = 0; index < input.labels.length; index++) {
    if (index > 0) doc.addPage({ size: [A5.width, A5.height], margin: 0 });
    await drawLabel(doc, input.labels[index]);
  }
  doc.end();
  return done;
}
