// backend/src/tickets/booking-ticket.pdf.ts
// [10/10/2026] v1 — Billet de voyage PDF A5 (portrait) : en-tête de marque, trajet en frise (départ → arrivée), voyageurs et conducteur,
// puis un talon détachable avec le QR code, la référence et le montant payé. Aucune donnée de paiement ni aucun code à usage unique
// (le code de prise en charge n'existe pas encore à l'achat et ne figure jamais sur un document imprimable).
import { A5, COLORS, createA5Document, fitText, paragraph, type Doc } from './pdf-kit';
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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(date: Date, timeZone: string): string {
  return capitalize(
    new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(date),
  );
}

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone }).format(date).replace(':', ':');
}

function formatShortDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }).format(date);
}

const M = 26;

function label(doc: Doc, text: string, x: number, y: number, width = 160) {
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.muted).text(text, x, y, { width, characterSpacing: 0.9, lineBreak: false });
}

function header(doc: Doc, reference: string) {
  doc.rect(0, 0, A5.width, 92).fill(COLORS.base);
  // Voile plus foncé en bas à droite : donne de la profondeur sans image.
  doc.save();
  doc.circle(A5.width - 20, 8, 96).fillOpacity(0.18).fill(COLORS.deep);
  doc.restore();
  doc.rect(0, 92, A5.width, 4).fill(COLORS.gold);

  doc.font('Helvetica-Bold').fontSize(27).fillColor(COLORS.white).text("Occa'Z", M, 26, { lineBreak: false });
  doc.font('Helvetica').fontSize(8.5).fillColor('#BFE6FA').text('Transport partagé · Voyageurs & colis', M, 60, { lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.white).text('E-BILLET', M, 28, {
    width: A5.width - 2 * M,
    align: 'right',
    characterSpacing: 1.5,
    lineBreak: false,
  });
  doc.font('Helvetica').fontSize(8.5).fillColor('#BFE6FA').text(`Réf. ${reference}`, M, 46, {
    width: A5.width - 2 * M,
    align: 'right',
    lineBreak: false,
  });
}

function stopRow(
  doc: Doc,
  y: number,
  options: { time: string | null; city: string; place: string | null; tag: string; filled: boolean },
) {
  const timeX = M;
  const dotX = 100;
  const textX = 118;
  const textWidth = A5.width - M - textX;

  if (options.time) {
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.ink).text(options.time, timeX, y, { width: 62, lineBreak: false });
  }
  if (options.filled) {
    doc.circle(dotX, y + 9, 6).fill(COLORS.base);
  } else {
    doc.circle(dotX, y + 9, 6).lineWidth(2.5).fillAndStroke(COLORS.white, COLORS.base);
  }
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.base).text(options.tag, textX, y - 9, { characterSpacing: 0.9, lineBreak: false });
  fitText(doc, options.city, textX, y + 1, textWidth, { font: 'Helvetica-Bold', size: 16, minSize: 10, color: COLORS.deep });
  if (options.place) {
    paragraph(doc, options.place, textX, y + 22, textWidth, { font: 'Helvetica', size: 8.5, color: COLORS.muted, maxLines: 2 });
  }
}

function infoCell(doc: Doc, title: string, value: string, x: number, y: number, width: number, maxLines = 1) {
  label(doc, title, x, y, width);
  paragraph(doc, value, x, y + 11, width, { font: 'Helvetica-Bold', size: 9.5, color: COLORS.ink, maxLines });
}

export async function renderBookingTicket(data: BookingTicketData): Promise<Buffer> {
  const { doc, done } = createA5Document({
    title: `Billet Occa'Z ${data.reference}`,
    subject: `${pdfSafe(data.originCity)} - ${pdfSafe(data.destinationCity)}`,
  });
  const qr = await qrPng(data.qrPayload);
  const tz = data.timeZone;

  header(doc, data.reference);

  // --- Le voyage ---
  label(doc, 'VOTRE VOYAGE', M, 108);
  doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.ink).text(pdfSafe(formatDate(data.departureAt, tz)), M, 120, {
    width: A5.width - 2 * M,
    lineBreak: false,
  });

  // Frise : un trait entre les deux points, derrière les pastilles.
  const lineTop = 160 + 9;
  const lineBottom = 230 + 9;
  doc.moveTo(100, lineTop).lineTo(100, lineBottom).lineWidth(2).strokeColor(COLORS.line).stroke();

  stopRow(doc, 160, {
    time: data.boardingTimeKnown ? formatTime(data.departureAt, tz) : null,
    city: pdfSafe(data.originCity),
    place: pdfSafe(data.originPlace) || null,
    tag: 'DÉPART · PRISE EN CHARGE',
    filled: true,
  });
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(
    `${data.seatsCount} place${data.seatsCount > 1 ? 's' : ''} · trajet partagé`,
    118,
    204,
    { lineBreak: false },
  );
  stopRow(doc, 230, {
    time: data.arrivalAt ? formatTime(data.arrivalAt, tz) : null,
    city: pdfSafe(data.destinationCity),
    place: pdfSafe(data.destinationPlace) || null,
    tag: 'ARRIVÉE · DÉPOSE',
    filled: false,
  });

  // --- Voyageurs, conducteur, véhicule ---
  const panelTop = 288;
  doc.roundedRect(M, panelTop, A5.width - 2 * M, 80, 12).fill(COLORS.mist);
  const colWidth = (A5.width - 2 * M - 36) / 2;
  const leftX = M + 14;
  const rightX = M + 14 + colWidth + 8;
  infoCell(doc, data.passengers.length > 1 ? 'VOYAGEURS' : 'VOYAGEUR', pdfSafe(data.passengers.join(', ')) || '—', leftX, panelTop + 12, colWidth, 2);
  infoCell(doc, 'PLACES', String(data.seatsCount), rightX, panelTop + 12, colWidth);
  infoCell(doc, 'CONDUCTEUR', pdfSafe(data.driverName) || '—', leftX, panelTop + 48, colWidth);
  infoCell(doc, 'VÉHICULE', pdfSafe(data.vehicle) || '—', rightX, panelTop + 48, colWidth);

  // --- Ligne de coupe ---
  const cutY = 384;
  doc.moveTo(M + 10, cutY).lineTo(A5.width - M - 10, cutY).lineWidth(1).dash(4, { space: 4 }).strokeColor('#9DB7C9').stroke().undash();
  doc.circle(0, cutY, 10).fill(COLORS.mist);
  doc.circle(A5.width, cutY, 10).fill(COLORS.mist);

  // --- Talon : QR code, référence, montant ---
  const qrSize = 118;
  const qrX = M + 6;
  const qrY = 406;
  doc.roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 10).lineWidth(1).strokeColor(COLORS.line).stroke();
  doc.image(qr, qrX, qrY, { width: qrSize, height: qrSize });

  const infoX = qrX + qrSize + 34;
  const infoWidth = A5.width - M - infoX;
  label(doc, 'RÉFÉRENCE', infoX, qrY - 2, infoWidth);
  fitText(doc, data.reference, infoX, qrY + 9, infoWidth, { font: 'Courier-Bold', size: 17, minSize: 11, color: COLORS.deep });
  label(doc, 'MONTANT PAYÉ', infoX, qrY + 44, infoWidth);
  fitText(doc, pdfSafe(data.amountPaid), infoX, qrY + 55, infoWidth, { font: 'Helvetica-Bold', size: 15, minSize: 9, color: COLORS.ink });
  label(doc, 'RÉSERVÉ LE', infoX, qrY + 88, infoWidth);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text(formatShortDate(data.bookedAt, tz), infoX, qrY + 99, { lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.base).text('Présentez ce QR code au conducteur', M, qrY + qrSize + 16, {
    width: A5.width - 2 * M,
    align: 'center',
    lineBreak: false,
  });
  paragraph(
    doc,
    "Billet personnel. Le code à 6 chiffres de prise en charge vous est envoyé quand le conducteur arrive : ne le donnez qu'au conducteur, jamais avant.",
    M + 10,
    qrY + qrSize + 30,
    A5.width - 2 * M - 20,
    { font: 'Helvetica', size: 7, color: COLORS.muted, maxLines: 2, align: 'center' },
  );
  doc.font('Helvetica').fontSize(6).fillColor('#8DA0AF').text(`Occa'Z · billet généré le ${formatShortDate(new Date(), tz)}`, M, A5.height - 16, {
    width: A5.width - 2 * M,
    align: 'center',
    lineBreak: false,
  });

  doc.end();
  return done;
}
