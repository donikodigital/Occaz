// backend/src/tickets/booking-ticket.pdf.ts
// [25/10/2026] v2 — Billet refait sur le modèle d'un e-billet de train : une feuille A4 en quatre volets (à plier en quatre, format A6)
//   ① « Mon billet » : QR code, date et itinéraire en frise · ② logo, dossier de voyage, voyageurs, prix et liste « Prêts ? Embarquez ! »
//   ③ « Bon à savoir » · ④ volet illustré (dessin vectoriel + logo). Couleurs Occa'Z conservées.
// [10/10/2026] v1 — Billet de voyage PDF A5 (portrait). Aucune donnée de paiement ni aucun code à usage unique (le code de prise en charge
// n'existe pas encore à l'achat et ne figure jamais sur un document imprimable).
import PDFDocument from 'pdfkit';
import { BRAND_LOGO_PNG } from '../platform-wallet/brand-logo';
import { COLORS, fitText, paragraph, type Doc } from './pdf-kit';
import { qrPng } from './barcodes';
import { pdfSafe } from './pdf-text';

export interface BookingTicketData {
  reference: string;
  qrPayload: string;
  /** Fuseau d'affichage des heures (ex. « Africa/Conakry »). */
  timeZone: string;
  departureAt: Date;
  /** Heure de passage connue au point de montée ; absente pour une étape sans estimation. */
  boardingTimeKnown: boolean;
  originCity: string;
  originPlace: string | null;
  destinationCity: string;
  destinationPlace: string | null;
  /** Heure d'arrivée estimée au point de descente, si le conducteur l'a renseignée. */
  arrivalAt: Date | null;
  passengers: string[];
  seatsCount: number;
  driverName: string;
  vehicle: string | null;
  /** « 235 000 GNF » — déjà formaté. */
  amountPaid: string;
  bookedAt: Date;
}

/** A4 portrait en points PDF : quatre volets A6 de 297,64 × 420,94. */
const PAGE = { width: 595.28, height: 841.89 } as const;
const PW = PAGE.width / 2;
const PH = PAGE.height / 2;
const PAD = 24;
const CW = PW - 2 * PAD;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(date: Date, timeZone: string): string {
  return capitalize(
    new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(date),
  );
}

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(date);
}

function formatShortDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }).format(date);
}

/** « 3h20 » ou « 45 min » ; null si l'arrivée n'est pas après le départ. */
export function durationText(from: Date, to: Date | null): string | null {
  if (!to) return null;
  const minutes = Math.round((to.getTime() - from.getTime()) / 60000);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return `${hours}h${String(rest).padStart(2, '0')}`;
}

// ─── Petits éléments de dessin ───────────────────────────────────────────────────────────────────────────────────────────────

/** Titre de volet : texte en couleur de marque et filet dessous. Renvoie le y suivant. */
function panelTitle(doc: Doc, text: string, x: number, y: number): number {
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.base).text(pdfSafe(text).toUpperCase(), x, y, { width: CW, characterSpacing: 0.6, lineBreak: false });
  doc.moveTo(x, y + 18).lineTo(x + CW, y + 18).lineWidth(1).strokeColor(COLORS.line).stroke();
  return y + 28;
}

/** « Libellé : valeur » : valeur en gras, retour à la ligne aligné sous la valeur. Renvoie la hauteur occupée. */
function keyValue(doc: Doc, label: string, value: string, x: number, y: number, width: number, maxLines = 1, valueColor: string = COLORS.ink): number {
  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
  const labelText = `${pdfSafe(label)} : `;
  const labelWidth = doc.widthOfString(labelText);
  doc.text(labelText, x, y, { lineBreak: false });
  if (maxLines === 1) {
    return fitText(doc, pdfSafe(value) || '—', x + labelWidth, y, width - labelWidth - 4, { font: 'Helvetica-Bold', size: 8.5, minSize: 6.5, color: valueColor }) + 4.5;
  }
  return paragraph(doc, pdfSafe(value) || '—', x + labelWidth, y, width - labelWidth, { font: 'Helvetica-Bold', size: 8.5, color: valueColor, maxLines, lineGap: 1.5 }) + 4.5;
}

function checkMark(doc: Doc, cx: number, cy: number, size: number, color: string) {
  doc
    .moveTo(cx - size * 0.45, cy)
    .lineTo(cx - size * 0.1, cy + size * 0.35)
    .lineTo(cx + size * 0.5, cy - size * 0.35)
    .lineWidth(Math.max(1.2, size * 0.18))
    .lineCap('round')
    .lineJoin('round')
    .strokeColor(color)
    .stroke();
  doc.lineCap('butt').lineJoin('miter');
}

// ─── ① Mon billet ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function ticketPanel(doc: Doc, data: BookingTicketData, qr: Buffer) {
  const tz = data.timeZone;

  // Bandeau « Mon billet »
  doc.save();
  doc.roundedRect(PAD, 26, CW, 26, 4).clip();
  doc.rect(PAD, 26, CW, 26).fill(COLORS.base);
  doc.circle(PAD + CW - 10, 20, 40).fillOpacity(0.22).fill(COLORS.deep);
  doc.circle(PAD + 14, 62, 26).fillOpacity(0.14).fill(COLORS.bright);
  doc.restore();
  doc.rect(PAD, 52, CW, 2.5).fill(COLORS.gold);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.white).text('Mon billet', PAD, 33.5, { width: CW, align: 'center', lineBreak: false });

  // QR code et référence
  const qrSize = 104;
  const qrX = (PW - qrSize) / 2;
  doc.image(qr, qrX, 70, { width: qrSize, height: qrSize });
  doc.font('Courier-Bold').fontSize(9).fillColor(COLORS.deep).text(pdfSafe(data.reference), PAD, 70 + qrSize + 7, { width: CW, align: 'center', lineBreak: false, characterSpacing: 0.8 });

  // Date
  fitText(doc, pdfSafe(formatDate(data.departureAt, tz)).toUpperCase(), PAD, 200, CW, { font: 'Helvetica-Bold', size: 11.5, minSize: 8, color: COLORS.base });

  // Itinéraire en frise
  const timeX = PAD;
  const timeW = 46;
  const dotX = PAD + 60;
  const textX = dotX + 14;
  const textW = PW - PAD - textX;
  const depY = 226;
  const midY = 282;
  const arrY = 340;

  doc.moveTo(dotX, depY + 5).lineTo(dotX, arrY + 5).lineWidth(1.6).strokeColor(COLORS.line).stroke();

  const stop = (y: number, time: Date | null, known: boolean, city: string, place: string | null, filled: boolean) => {
    if (time && known) {
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink).text(formatTime(time, tz), timeX, y - 1.5, { width: timeW, lineBreak: false });
    } else {
      doc.font('Helvetica-Oblique').fontSize(6.8).fillColor(COLORS.muted).text('heure à confirmer', timeX, y + 1, { width: timeW, lineBreak: false });
    }
    if (filled) doc.circle(dotX, y + 5, 5).fill(COLORS.base);
    else doc.circle(dotX, y + 5, 5).lineWidth(2.2).fillAndStroke(COLORS.white, COLORS.base);
    fitText(doc, pdfSafe(city).toUpperCase(), textX, y - 1, textW, { font: 'Helvetica-Bold', size: 11, minSize: 7.5, color: COLORS.deep });
    if (place) paragraph(doc, place, textX, y + 13, textW, { font: 'Helvetica', size: 7.8, color: COLORS.muted, maxLines: 2 });
  };

  stop(depY, data.departureAt, data.boardingTimeKnown, data.originCity, pdfSafe(data.originPlace) || null, true);

  const duration = durationText(data.departureAt, data.arrivalAt);
  if (duration && data.boardingTimeKnown) {
    doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.muted).text(duration, timeX, midY + 2, { width: timeW, lineBreak: false });
  }
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.base).text('Trajet partagé', textX, midY - 1, { width: textW, lineBreak: false });
  doc.font('Helvetica').fontSize(7.8).fillColor(COLORS.ink).text(
    `${data.seatsCount} place${data.seatsCount > 1 ? 's' : ''} réservée${data.seatsCount > 1 ? 's' : ''}`,
    textX,
    midY + 11,
    { width: textW, lineBreak: false },
  );

  stop(arrY, data.arrivalAt, true, data.destinationCity, pdfSafe(data.destinationPlace) || null, false);
}

// ─── ② Dossier de voyage et liste « Prêts ? Embarquez ! » ────────────────────────────────────────────────────────────────────

function dossierPanel(doc: Doc, data: BookingTicketData) {
  const x0 = PW + PAD;
  const tz = data.timeZone;

  // Logo + nom de marque, alignés à droite
  const logoSize = 38;
  const logoX = PW + PW - PAD - logoSize;
  doc.image(BRAND_LOGO_PNG, logoX, 22, { width: logoSize, height: logoSize });
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.deep).text("Occa'Z", x0, 24, { width: logoX - 10 - x0, align: 'right', lineBreak: false });
  doc.font('Helvetica').fontSize(6.6).fillColor(COLORS.muted).text('Transport partagé · Voyageurs & colis', x0, 46, { width: logoX - 10 - x0, align: 'right', lineBreak: false });

  // Dossier
  let y = 92;
  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text('Dossier voyage : ', x0, y + 1.5, { lineBreak: false });
  const labelWidth = doc.widthOfString('Dossier voyage : ');
  fitText(doc, pdfSafe(data.reference), x0 + labelWidth, y - 1, CW - labelWidth, { font: 'Helvetica-Bold', size: 12, minSize: 8, color: COLORS.base });
  y += 22;
  y += keyValue(doc, data.passengers.length > 1 ? 'Voyageurs' : 'Voyageur', data.passengers.join(', '), x0, y, CW, 2);
  y += keyValue(doc, 'Places', String(data.seatsCount), x0, y, CW);
  y += keyValue(doc, 'Conducteur', data.driverName, x0, y, CW);
  y += keyValue(doc, 'Véhicule', data.vehicle ?? '', x0, y, CW);
  y += keyValue(doc, 'Réservé le', formatShortDate(data.bookedAt, tz), x0, y, CW);
  y += keyValue(doc, 'Prix', data.amountPaid, x0, y, CW, 1, COLORS.deep);

  // Prêts ? Embarquez !
  // Sous le dossier, mais jamais plus haut qu'à l'accoutumée (les lignes du dossier peuvent s'allonger avec de longs noms).
  const headY = Math.max(226, y + 14);
  doc.circle(x0 + 11, headY + 8, 11).fill(COLORS.base);
  checkMark(doc, x0 + 11, headY + 8, 11, COLORS.white);
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(COLORS.base).text('PRÊTS ? EMBARQUEZ !', x0 + 30, headY + 3, { width: CW - 30, lineBreak: false });

  const items = [
    'Je télécharge mon billet sur mon téléphone, ou je l’imprime.',
    'Mon téléphone est chargé : le conducteur peut m’appeler.',
    'Je me présente au point de prise en charge à l’heure indiquée.',
    'Je montre mon QR code au conducteur à la montée.',
    'Le code à 6 chiffres reçu à l’arrivée du conducteur : je ne le donne qu’à lui, jamais avant.',
  ];
  let itemY = headY + 32;
  for (const item of items) {
    doc.roundedRect(x0, itemY + 1, 9, 9, 2).lineWidth(0.9).strokeColor(COLORS.base).stroke();
    const used = paragraph(doc, pdfSafe(item), x0 + 17, itemY, CW - 17, { font: 'Helvetica', size: 7.8, color: COLORS.ink, maxLines: 2, lineGap: 1.2 });
    itemY += Math.max(used, 11) + 9;
  }
}

// ─── ③ Bon à savoir ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function infoPanel(doc: Doc, data: BookingTicketData) {
  const y0 = PH;
  let y = panelTitle(doc, 'Bon à savoir', PAD, y0 + 28);

  const sections: Array<[string, string]> = [
    [
      'Comment utiliser votre billet ?',
      'Ce billet est nominatif et personnel. Il est valable pour le trajet, la date et les points de rendez-vous indiqués. Gardez-le sur votre téléphone ou imprimez-le, puis montrez le QR code au conducteur.',
    ],
    [
      'Le code de prise en charge',
      'Un code à 6 chiffres vous est envoyé quand le conducteur arrive. Il confirme votre montée : ne le donnez qu’au conducteur, jamais avant et jamais à un tiers.',
    ],
    [
      'Un contre-temps ? Besoin d’annuler ?',
      'Depuis l’application Occa’Z, dans vos réservations. Le remboursement suit la politique d’annulation affichée au moment de la réservation.',
    ],
    [
      'Un souci pendant le trajet ?',
      'En cas d’urgence, utilisez l’alerte SOS de l’application Occa’Z. Pour un autre problème, signalez-le depuis votre réservation.',
    ],
  ];
  for (const [title, body] of sections) {
    doc.font('Helvetica-Bold').fontSize(8.6).fillColor(COLORS.deep).text(pdfSafe(title), PAD, y, { width: CW, lineBreak: false });
    const used = paragraph(doc, pdfSafe(body), PAD, y + 12, CW, { font: 'Helvetica', size: 7.6, color: COLORS.muted, maxLines: 4, lineGap: 1.4 });
    y += 12 + used + 11;
  }

  // Pied de volet : logo, marque, date d'édition
  const footY = y0 + PH - 52;
  doc.moveTo(PAD, footY).lineTo(PAD + CW, footY).lineWidth(0.8).strokeColor(COLORS.line).stroke();
  doc.image(BRAND_LOGO_PNG, PAD, footY + 10, { width: 22, height: 22 });
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.deep).text("Occa'Z · Transport partagé", PAD + 30, footY + 11, { width: CW - 30, lineBreak: false });
  doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.muted).text(`Billet ${pdfSafe(data.reference)} · généré le ${formatShortDate(new Date(), data.timeZone)}`, PAD + 30, footY + 23, { width: CW - 30, lineBreak: false });
}

// ─── ④ Volet illustré ────────────────────────────────────────────────────────────────────────────────────────────────────────

function cloud(doc: Doc, cx: number, cy: number, scale: number, opacity: number) {
  doc.save();
  doc.fillOpacity(opacity).fillColor(COLORS.white);
  doc.circle(cx, cy, 9 * scale).fill();
  doc.circle(cx + 11 * scale, cy - 5 * scale, 12 * scale).fill();
  doc.circle(cx + 25 * scale, cy, 9 * scale).fill();
  doc.roundedRect(cx - 9 * scale, cy, 43 * scale, 9 * scale, 4.5 * scale).fill();
  doc.restore();
}

function van(doc: Doc, x: number, y: number) {
  // Colis sur le toit
  doc.roundedRect(x + 12, y - 9, 24, 10, 2).fill('#F4B740');
  doc.roundedRect(x + 40, y - 6, 18, 7, 2).fill(COLORS.gold);
  doc.moveTo(x + 24, y - 9).lineTo(x + 24, y + 1).lineWidth(1).strokeColor('#C78A1D').stroke();
  // Carrosserie
  doc.roundedRect(x, y, 84, 30, 7).fill(COLORS.white);
  doc.roundedRect(x + 60, y - 1, 24, 14, 6).fill(COLORS.white);
  // Vitres
  for (const [wx, ww] of [[8, 14], [26, 14], [44, 14]] as const) {
    doc.roundedRect(x + wx, y + 5, ww, 11, 2.5).fill('#BFE6FA');
  }
  doc.roundedRect(x + 63, y + 5, 15, 11, 3).fill('#BFE6FA');
  // Bande de couleur et phare
  doc.rect(x, y + 20, 84, 4).fill(COLORS.base);
  doc.roundedRect(x + 80, y + 17, 5, 5, 2).fill(COLORS.gold);
  // Roues
  for (const wx of [20, 64]) {
    doc.circle(x + wx, y + 31, 7.5).fill('#0E2A44');
    doc.circle(x + wx, y + 31, 3.2).fill('#9DB7C9');
  }
}

function pin(doc: Doc, cx: number, cy: number) {
  doc.save();
  doc.fillOpacity(0.9).lineWidth(1.2).strokeColor(COLORS.white).strokeOpacity(0.7);
  doc.ellipse(cx, cy + 24, 20, 5.5).stroke();
  doc.strokeOpacity(0.4).ellipse(cx, cy + 24, 32, 9).stroke();
  doc.restore();
  doc.path(`M ${cx} ${cy + 24} C ${cx - 20} ${cy + 2} ${cx - 17} ${cy - 20} ${cx} ${cy - 20} C ${cx + 17} ${cy - 20} ${cx + 20} ${cy + 2} ${cx} ${cy + 24} Z`).fill(COLORS.gold);
  doc.circle(cx, cy - 6, 6.5).fill(COLORS.white);
}

function illustrationPanel(doc: Doc) {
  const px = PW + 20;
  const py = PH + 20;
  const pw = PW - 40;
  const ph = PH - 40;

  doc.save();
  doc.roundedRect(px, py, pw, ph, 12).clip();
  doc.translate(px, py);

  // Ciel en dégradé
  const sky = doc.linearGradient(0, 0, 0, 300);
  sky.stop(0, COLORS.base).stop(0.55, COLORS.bright).stop(1, '#9ADBF6');
  doc.rect(0, 0, pw, 310).fill(sky);

  // Soleil et halo
  doc.save();
  doc.fillOpacity(0.22).circle(62, 236, 46).fill(COLORS.white);
  doc.restore();
  doc.circle(62, 236, 26).fill(COLORS.gold);

  // Nuages
  cloud(doc, 28, 168, 1, 0.85);
  cloud(doc, 150, 196, 0.8, 0.7);
  cloud(doc, 118, 150, 0.6, 0.6);

  // Collines
  doc.save();
  doc.fillOpacity(0.55);
  doc.path(`M 0 262 C 50 226 100 250 150 258 S 226 238 ${pw} 252 L ${pw} 320 L 0 320 Z`).fill('#2D8CC4');
  doc.restore();
  doc.path(`M 0 286 C 60 262 120 292 182 278 S 236 270 ${pw} 280 L ${pw} 322 L 0 322 Z`).fill(COLORS.base);

  // Sol et route
  doc.rect(0, 306, pw, ph - 306).fill('#0A4D7C');
  doc.rect(0, 312, pw, 44).fill('#0E2A44');
  doc.moveTo(0, 312).lineTo(pw, 312).lineWidth(1.2).strokeColor('#9DB7C9').stroke();
  doc.moveTo(0, 356).lineTo(pw, 356).lineWidth(1.2).strokeColor('#9DB7C9').stroke();
  doc.moveTo(0, 340).lineTo(pw, 340).lineWidth(1.8).dash(12, { space: 9 }).strokeColor(COLORS.white).stroke().undash();

  // Trajet pointillé du véhicule vers le point d'arrivée
  doc.save();
  doc.moveTo(82, 284).bezierCurveTo(110, 220, 170, 262, 204, 236).lineWidth(1.6).dash(2, { space: 5 }).lineCap('round').strokeColor(COLORS.white).stroke().undash();
  doc.restore();
  pin(doc, 206, 214);
  van(doc, 34, 292);

  // Slogan (ombre portée légère puis texte)
  const lines = ['VOYAGEZ', 'ENSEMBLE,', 'ARRIVEZ', 'SEREINS.'];
  doc.font('Helvetica-BoldOblique').fontSize(24);
  lines.forEach((line, index) => {
    const ty = 20 + index * 26;
    doc.save();
    doc.fillOpacity(0.28).fillColor(COLORS.deep).text(line, 14 + 1.4, ty + 1.4, { width: pw - 28, align: 'right', lineBreak: false });
    doc.restore();
    doc.font('Helvetica-BoldOblique').fontSize(24).fillColor(COLORS.white).text(line, 14, ty, { width: pw - 28, align: 'right', lineBreak: false });
  });

  // Pastille
  const tag = 'TRANSPORT PARTAGÉ · VOYAGEURS & COLIS';
  doc.font('Helvetica-Bold').fontSize(6.8);
  const tagW = doc.widthOfString(tag) + tag.length * 0.5 + 22;
  doc.roundedRect(pw - 14 - tagW, 130, tagW, 17, 8.5).fill(COLORS.white);
  doc.fillColor(COLORS.base).text(tag, pw - 14 - tagW + 11, 135.5, { width: tagW, characterSpacing: 0.5, lineBreak: false });

  // Logo dans une pastille blanche
  const cx = pw - 38;
  const cy = ph - 38;
  doc.circle(cx, cy, 27).fill(COLORS.white);
  doc.save();
  doc.circle(cx, cy, 22).clip();
  doc.image(BRAND_LOGO_PNG, cx - 22, cy - 22, { width: 44, height: 44 });
  doc.restore();

  doc.restore();
}

/** Repères de pliage : une croix pointillée discrète au centre de la feuille. */
function foldMarks(doc: Doc) {
  doc.save();
  doc.lineWidth(0.5).strokeColor('#B8C9D6').dash(3, { space: 3 });
  doc.moveTo(PW, 0).lineTo(PW, PAGE.height).stroke();
  doc.moveTo(0, PH).lineTo(PAGE.width, PH).stroke();
  doc.undash();
  doc.restore();
}

export async function renderBookingTicket(data: BookingTicketData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [PAGE.width, PAGE.height],
    margin: 0,
    autoFirstPage: true,
    info: { Title: `Billet Occa'Z ${data.reference}`, Subject: `${pdfSafe(data.originCity)} - ${pdfSafe(data.destinationCity)}`, Author: "Occa'Z", Creator: "Occa'Z" },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const qr = await qrPng(data.qrPayload);

  ticketPanel(doc, data, qr);
  dossierPanel(doc, data);
  infoPanel(doc, data);
  illustrationPanel(doc);
  foldMarks(doc);

  doc.end();
  return done;
}