// backend/src/platform-wallet/expense-document.pdf.ts
// [25/10/2026] v2 — Bulletin de salaire refait sur le modèle d'un bulletin français classique (logo, tableau à colonnes, cumuls, net payé), sans bandeau de couleur.
// [25/10/2026] v1 — Pièces comptables PDF (A4) d'un retrait de la plateforme, une mise en page par motif :
//   Salaire → bulletin de paie · Primes → reçu de prime · Fournitures / Équipements → facture d'achat
//   Frais de voyage → note de frais · Fonctionnement / Autres → justificatif de dépense
// Tout vient de données figées au moment du retrait (identité, fiche de paie, lignes) : le PDF est identique à chaque téléchargement.
// Les pièces de type « facture d'achat » sont des documents INTERNES établis par Occa'Z : elles ne remplacent pas la facture du fournisseur.
import PDFDocument from 'pdfkit';
import { amountInWords, capitalizeFirst } from '../common/utils/amount-in-words';
import { formatMoneyWithCurrency } from '../common/utils/money.util';
import { COLORS, fitText, paragraph, type Doc } from '../tickets/pdf-kit';
import { pdfSafe } from '../tickets/pdf-text';
import { BRAND_LOGO_PNG } from './brand-logo';
import { EXPENSE_CATEGORIES, periodLabel, type StoredExpenseDetails } from './expense-categories';
import type { ExpenseCategory } from '@prisma/client';

export interface ExpenseDocumentData {
  category: ExpenseCategory;
  /** Libellé du motif (« Autres » : le texte saisi). */
  categoryText: string;
  documentNumber: string;
  issuedAt: Date;
  timeZone: string;
  company: { name: string; address?: string; phone?: string; email?: string; registration?: string };
  amount: bigint;
  isoCode: string;
  status: 'PROCESSING' | 'PAID' | 'FAILED';
  processedAt: Date | null;
  periodMonth: string | null;
  details: StoredExpenseDetails;
  /** Qui reçoit l'argent (compte Orange Money enregistré) — le numéro est masqué. */
  beneficiaryName: string;
  beneficiaryPhoneMasked: string;
  paymentMethod: string;
  paymentRef: string | null;
  issuedBy: string | null;
  /** Cumul de l'année (bulletins SALAIRE de la même personne, janvier → période). Absent : le cumul se limite à ce bulletin. */
  yearToDate?: { gross: bigint; deductions: bigint; net: bigint };
}

const W = 595.28;
const H = 841.89;
const M = 40;
const CW = W - 2 * M;
const FOOTER_Y = H - 46;

const METHOD_LABELS: Record<string, string> = { orange_money: 'Orange Money', mobile_money: 'Mobile Money' };

function dateText(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }).format(date);
}

function longDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(date);
}

/** « 2026-10-05 » → « 05/10/2026 » ; toute autre saisie est reprise telle quelle. */
function isoDateText(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : (value ?? '');
}

function money(amount: bigint | string, isoCode: string): string {
  return pdfSafe(formatMoneyWithCurrency(amount, isoCode));
}

function sectionTitle(doc: Doc, text: string, x: number, y: number, width: number): number {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.base).text(pdfSafe(text).toUpperCase(), x, y, { width, characterSpacing: 1, lineBreak: false });
  doc.moveTo(x, y + 13).lineTo(x + width, y + 13).lineWidth(0.8).strokeColor(COLORS.line).stroke();
  return y + 20;
}

/** Libellé + valeur sur deux lignes. Renvoie la hauteur occupée. */
function field(doc: Doc, label: string, value: string | null | undefined, x: number, y: number, width: number): number {
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.muted).text(pdfSafe(label).toUpperCase(), x, y, { width, characterSpacing: 0.8, lineBreak: false });
  const text = pdfSafe(value) || '—';
  const used = paragraph(doc, text, x, y + 10, width, { font: 'Helvetica-Bold', size: 9.5, color: COLORS.ink, maxLines: 2 });
  return 10 + used + 7;
}

function statusInfo(data: ExpenseDocumentData): { text: string; fill: string; ink: string } {
  if (data.status === 'PAID') {
    return { text: data.processedAt ? `PAYÉ LE ${dateText(data.processedAt, data.timeZone)}` : 'PAYÉ', fill: '#E3F6EA', ink: '#17663A' };
  }
  if (data.status === 'FAILED') return { text: 'PAIEMENT ANNULÉ', fill: '#FDE8E8', ink: '#9B1C1C' };
  return { text: 'PAIEMENT EN COURS', fill: '#FFF4D6', ink: COLORS.goldInk };
}

/** Bandeau de marque + titre de la pièce + numéro. Renvoie le y où commence le contenu. */
function header(doc: Doc, data: ExpenseDocumentData, continued: boolean): number {
  const info = EXPENSE_CATEGORIES[data.category];
  const height = continued ? 56 : 104;
  doc.rect(0, 0, W, height).fill(COLORS.base);
  doc.save();
  doc.circle(W - 30, 0, continued ? 70 : 120).fillOpacity(0.16).fill(COLORS.deep);
  doc.restore();
  doc.rect(0, height, W, 4).fill(COLORS.gold);

  const company = pdfSafe(data.company.name) || "Occa'Z";
  if (continued) {
    fitText(doc, company, M, 18, 260, { font: 'Helvetica-Bold', size: 16, color: COLORS.white });
    fitText(doc, `${pdfSafe(info.documentTitle)} · ${pdfSafe(data.documentNumber)} (suite)`, M, 38, CW, { font: 'Helvetica', size: 8.5, color: '#BFE6FA' });
    return height + 24;
  }

  fitText(doc, company, M, 24, 270, { font: 'Helvetica-Bold', size: 25, color: COLORS.white });
  const contact = [data.company.address, data.company.phone, data.company.email].map((v) => pdfSafe(v)).filter(Boolean).join('  ·  ');
  if (contact) fitText(doc, contact, M, 58, 300, { font: 'Helvetica', size: 7.5, color: '#BFE6FA' });
  if (data.company.registration) fitText(doc, pdfSafe(data.company.registration), M, 72, 300, { font: 'Helvetica', size: 7.5, color: '#BFE6FA' });

  fitText(doc, pdfSafe(info.documentTitle), W - M - 250, 26, 250, { font: 'Helvetica-Bold', size: 15, color: COLORS.white, align: 'right' });
  fitText(doc, `N° ${pdfSafe(data.documentNumber)}`, W - M - 250, 50, 250, { font: 'Helvetica', size: 10, color: '#BFE6FA', align: 'right' });
  fitText(doc, `Émis le ${longDate(data.issuedAt, data.timeZone)}`, W - M - 250, 66, 250, { font: 'Helvetica', size: 8.5, color: '#BFE6FA', align: 'right' });
  return height + 28;
}

function footer(doc: Doc, data: ExpenseDocumentData, note: string | null) {
  doc.moveTo(M, FOOTER_Y).lineTo(W - M, FOOTER_Y).lineWidth(0.6).strokeColor(COLORS.line).stroke();
  if (note) {
    doc.font('Helvetica-Oblique').fontSize(7).fillColor(COLORS.muted).text(pdfSafe(note), M, FOOTER_Y + 6, { width: CW, lineBreak: true, lineGap: 1 });
  }
  const bottom = `${pdfSafe(data.company.name) || "Occa'Z"} · pièce ${pdfSafe(data.documentNumber)}`;
  doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.muted).text(bottom, M, H - 22, { width: CW, align: 'right', lineBreak: false });
}

function statusBadge(doc: Doc, data: ExpenseDocumentData, x: number, y: number) {
  const status = statusInfo(data);
  doc.font('Helvetica-Bold').fontSize(7.5);
  const width = doc.widthOfString(status.text) + 20;
  doc.roundedRect(x, y, width, 18, 9).fill(status.fill);
  doc.fillColor(status.ink).text(status.text, x + 10, y + 5.5, { width: width - 20, lineBreak: false });
}

/** Cadre du montant : valeur en gros + montant en toutes lettres. Renvoie le y suivant. */
function amountBox(doc: Doc, data: ExpenseDocumentData, label: string, y: number): number {
  const words = `${capitalizeFirst(amountInWords(data.amount))} ${pdfSafe(data.isoCode === 'GNF' ? 'francs guinéens' : data.isoCode === 'XOF' ? 'francs CFA' : data.isoCode)}`;
  doc.roundedRect(M, y, CW, 70, 8).fill(COLORS.mist);
  doc.rect(M, y, 5, 70).fill(COLORS.base);
  doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted).text(pdfSafe(label).toUpperCase(), M + 20, y + 11, { width: 260, characterSpacing: 1, lineBreak: false });
  fitText(doc, money(data.amount, data.isoCode), M + 20, y + 24, 300, { font: 'Helvetica-Bold', size: 21, color: COLORS.deep });
  paragraph(doc, `Arrêté à la somme de : ${words}.`, M + 20, y + 52, CW - 36, { font: 'Helvetica-Oblique', size: 8, color: COLORS.ink, maxLines: 1 });
  statusBadge(doc, data, W - M - 170, y + 14);
  return y + 86;
}

function paymentBlock(doc: Doc, data: ExpenseDocumentData, y: number): number {
  let top = sectionTitle(doc, 'Règlement', M, y, CW);
  const half = (CW - 20) / 2;
  const method = METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod;
  const a = field(doc, 'Bénéficiaire du paiement', data.beneficiaryName, M, top, half);
  const b = field(doc, 'Mode de paiement', `${method} · ${data.beneficiaryPhoneMasked}`, M + half + 20, top, half);
  top += Math.max(a, b);
  if (data.paymentRef) top += field(doc, 'Référence de la transaction', data.paymentRef, M, top, CW);
  return top + 4;
}

function signatures(doc: Doc, data: ExpenseDocumentData, y: number, left: string, right: string): number {
  const width = (CW - 30) / 2;
  for (const [index, label] of [left, right].entries()) {
    const x = M + index * (width + 30);
    doc.roundedRect(x, y, width, 74, 6).lineWidth(0.8).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.muted).text(pdfSafe(label).toUpperCase(), x + 12, y + 10, { width: width - 24, characterSpacing: 0.8, lineBreak: false });
  }
  if (data.issuedBy) {
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text(`Établi par ${pdfSafe(data.issuedBy)}`, M, y + 82, { width: CW, lineBreak: false });
  }
  return y + 96;
}

/** Ajoute une page de suite (en-tête réduit) et renvoie le y de départ. */
function nextPage(doc: Doc, data: ExpenseDocumentData, note: string | null): number {
  footer(doc, data, note);
  doc.addPage();
  return header(doc, data, true);
}

// ─── Lignes de facture / de frais ─────────────────────────────────────────────────────────────────────────────────────────

function linesTable(doc: Doc, data: ExpenseDocumentData, y: number, title: string, note: string | null): number {
  const lines = data.details.lines ?? [];
  const col = { n: M + 8, desc: M + 34, qty: M + 285, unit: M + 330, total: M + 425 };
  let top = sectionTitle(doc, title, M, y, CW);

  const head = (at: number) => {
    doc.rect(M, at, CW, 20).fill(COLORS.deep);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white);
    doc.text('N°', col.n, at + 6.5, { width: 24, lineBreak: false });
    doc.text('DÉSIGNATION', col.desc, at + 6.5, { width: 240, lineBreak: false });
    doc.text('QTÉ', col.qty, at + 6.5, { width: 40, align: 'right', lineBreak: false });
    doc.text('PRIX UNITAIRE', col.unit, at + 6.5, { width: 85, align: 'right', lineBreak: false });
    doc.text('TOTAL', col.total, at + 6.5, { width: CW - (col.total - M) - 8, align: 'right', lineBreak: false });
    return at + 20;
  };
  top = head(top);

  lines.forEach((line, index) => {
    if (top + 24 > FOOTER_Y - 20) {
      top = head(nextPage(doc, data, note));
    }
    if (index % 2 === 0) doc.rect(M, top, CW, 24).fill('#F5FAFD');
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(String(index + 1), col.n, top + 8, { width: 24, lineBreak: false });
    fitText(doc, pdfSafe(line.description), col.desc, top + 7.5, 244, { font: 'Helvetica', size: 9, minSize: 7, color: COLORS.ink });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink).text(String(line.quantity), col.qty, top + 7.5, { width: 40, align: 'right', lineBreak: false });
    fitText(doc, money(line.unitPrice, data.isoCode), col.unit, top + 7.5, 85, { font: 'Helvetica', size: 9, minSize: 7, color: COLORS.ink, align: 'right' });
    fitText(doc, money(line.total, data.isoCode), col.total, top + 7.5, CW - (col.total - M) - 8, { font: 'Helvetica-Bold', size: 9, minSize: 7, color: COLORS.ink, align: 'right' });
    top += 24;
  });
  doc.moveTo(M, top).lineTo(W - M, top).lineWidth(0.8).strokeColor(COLORS.line).stroke();
  return top + 14;
}

// ─── Bulletin de salaire ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Mise en page classique d'un bulletin français : logo et employeur en haut à gauche, titre et période au centre, identité du salarié
// et son cadre d'adresse, tableau « Éléments de paie » à cinq colonnes, cumuls mensuel / annuel, puis le net payé. Noir sur blanc,
// police à empattements, aucune bande de couleur.

const SERIF = 'Times-Roman';
const SERIF_BOLD = 'Times-Bold';
const SERIF_ITALIC = 'Times-Italic';
const SLIP_INK = '#000000';
const SLIP_RULE = '#3A3A3A';
const SLIP_SOFT = '#9A9A9A';
const SLIP_MUTED = '#4A4A4A';
const SLIP_ROW = 19;
const SLIP_FOOTER_Y = H - 52;

/** « 285 000 » : le montant seul, la devise est annoncée au-dessus du tableau. */
function plainAmount(amount: bigint | string): string {
  return pdfSafe(new Intl.NumberFormat('fr-FR').format(BigInt(amount)));
}

/** Ancienneté en mois révolus à la fin de la période : « 2 ans 3 mois ». Null si l'embauche est inconnue ou postérieure. */
export function seniorityText(hireDate: string | null | undefined, period: string): string | null {
  const hire = /^(\d{4})-(\d{2})-(\d{2})$/.exec(hireDate ?? '');
  const end = /^(\d{4})-(\d{2})$/.exec(period);
  if (!hire || !end) return null;
  let months = (Number(end[1]) - Number(hire[1])) * 12 + (Number(end[2]) - Number(hire[2]));
  if (Number(hire[3]) === 1) months += 1;
  if (months < 0) return null;
  if (months < 1) return "moins d'un mois";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} an${years > 1 ? 's' : ''}`);
  if (rest > 0) parts.push(`${rest} mois`);
  return parts.join(' ');
}

interface SlipRow {
  label: string;
  base?: string;
  rate?: string;
  deduct?: string;
  pay?: string;
  style?: 'normal' | 'bold' | 'group';
  ruleAbove?: boolean;
}

const SLIP_COLS = [
  { title: 'Éléments de paie', w: 203 },
  { title: 'Base', w: 82 },
  { title: 'Taux', w: 58 },
  { title: 'À déduire', w: 86 },
  { title: 'À payer', w: CW - 203 - 82 - 58 - 86 },
];

function colX(index: number): number {
  return M + SLIP_COLS.slice(0, index).reduce((sum, col) => sum + col.w, 0);
}

function slipTableHead(doc: Doc, y: number): number {
  doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.9).strokeColor(SLIP_RULE).stroke();
  SLIP_COLS.forEach((col, index) => {
    fitText(doc, col.title, colX(index) + 4, y + 6, col.w - 8, { font: SERIF_BOLD, size: 10.5, color: SLIP_INK, align: 'center' });
  });
  doc.moveTo(M, y + 22).lineTo(W - M, y + 22).lineWidth(0.9).strokeColor(SLIP_RULE).stroke();
  return y + 22;
}

/** Cadre du tableau (bords et séparateurs de colonnes) sur la hauteur déjà remplie. */
function slipTableFrame(doc: Doc, top: number, bottom: number) {
  doc.rect(M, top, CW, bottom - top).lineWidth(0.9).strokeColor(SLIP_RULE).stroke();
  for (let index = 1; index < SLIP_COLS.length; index++) {
    doc.moveTo(colX(index), top).lineTo(colX(index), bottom).lineWidth(0.5).strokeColor(SLIP_SOFT).stroke();
  }
}

function slipRowDraw(doc: Doc, row: SlipRow, y: number) {
  if (row.ruleAbove) doc.moveTo(M, y).lineTo(W - M, y).lineWidth(0.7).strokeColor(SLIP_RULE).stroke();
  const font = row.style === 'bold' ? SERIF_BOLD : row.style === 'group' ? SERIF_BOLD : SERIF;
  const size = row.style === 'bold' ? 10.5 : 10;
  const ty = y + 4.5;
  fitText(doc, pdfSafe(row.label), colX(0) + 8, ty, SLIP_COLS[0].w - 14, { font: row.style === 'group' ? 'Times-BoldItalic' : font, size, minSize: 7.5, color: SLIP_INK });
  if (row.base) fitText(doc, row.base, colX(1) + 4, ty, SLIP_COLS[1].w - 12, { font: SERIF, size, minSize: 7.5, color: SLIP_INK, align: 'right' });
  if (row.rate) fitText(doc, row.rate, colX(2) + 4, ty, SLIP_COLS[2].w - 8, { font: SERIF, size, minSize: 7.5, color: SLIP_INK, align: 'center' });
  if (row.deduct) fitText(doc, row.deduct, colX(3) + 4, ty, SLIP_COLS[3].w - 12, { font, size, minSize: 7.5, color: SLIP_INK, align: 'right' });
  if (row.pay) fitText(doc, row.pay, colX(4) + 4, ty, SLIP_COLS[4].w - 12, { font, size, minSize: 7.5, color: SLIP_INK, align: 'right' });
}

function slipFooter(doc: Doc, data: ExpenseDocumentData) {
  doc.moveTo(M, SLIP_FOOTER_Y).lineTo(W - M, SLIP_FOOTER_Y).lineWidth(0.5).strokeColor(SLIP_SOFT).stroke();
  doc.font(SERIF_ITALIC).fontSize(9).fillColor(SLIP_INK).text(
    'Pour vous aider à faire valoir vos droits, conservez ce bulletin de paie sans limitation de durée.',
    M,
    SLIP_FOOTER_Y + 8,
    { width: CW, align: 'center', lineBreak: false },
  );
  const bottom = `${pdfSafe(data.company.name) || "Occa'Z"} · bulletin ${pdfSafe(data.documentNumber)} · établi d'après la fiche de paie enregistrée au moment du retrait`;
  doc.font(SERIF).fontSize(7.5).fillColor(SLIP_MUTED).text(bottom, M, SLIP_FOOTER_Y + 22, { width: CW, align: 'center', lineBreak: false });
}

function slipContinuedHeader(doc: Doc, data: ExpenseDocumentData, period: string): number {
  const company = pdfSafe(data.company.name) || "Occa'Z";
  fitText(doc, company, M, 36, 240, { font: SERIF_BOLD, size: 12, color: SLIP_INK });
  fitText(doc, `Bulletin de salaire — ${capitalizeFirst(pdfSafe(periodLabel(period)))} (suite)`, M, 54, CW, { font: SERIF, size: 11, color: SLIP_INK });
  return 84;
}

/** Bulletin de salaire complet (une ou plusieurs pages). Dessine aussi son propre pied de page. */
function payslipDocument(doc: Doc, data: ExpenseDocumentData) {
  const slip = data.details.payslip;
  const staff = data.details.staff;
  if (!slip || !staff) throw new Error('Bulletin de paie sans fiche figée.');
  const company = pdfSafe(data.company.name) || "Occa'Z";
  const period = capitalizeFirst(pdfSafe(periodLabel(slip.period)));

  // ── En-tête : logo + employeur · titre + période · nom de l'entreprise
  doc.image(BRAND_LOGO_PNG, M, 34, { width: 54, height: 54 });
  let leftEnd = 98;
  leftEnd += fitText(doc, company, M, leftEnd, 190, { font: SERIF_BOLD, size: 11, color: SLIP_INK }) + 3;
  const employerLines = [data.company.address, data.company.phone, data.company.email, data.company.registration].map((v) => pdfSafe(v)).filter(Boolean);
  for (const line of employerLines.slice(0, 4)) {
    leftEnd += fitText(doc, line, M, leftEnd, 190, { font: SERIF, size: 9, minSize: 7, color: SLIP_MUTED }) + 1.5;
  }

  fitText(doc, 'BULLETIN DE SALAIRE', 235, 42, 215, { font: SERIF_BOLD, size: 16, color: SLIP_INK, align: 'center' });
  fitText(doc, `Période : ${period}`, 235, 66, 215, { font: SERIF, size: 12, color: SLIP_INK, align: 'center' });
  fitText(doc, `N° ${pdfSafe(data.documentNumber)}`, 235, 84, 215, { font: SERIF_ITALIC, size: 8.5, color: SLIP_MUTED, align: 'center' });
  fitText(doc, company, 455, 42, W - M - 455, { font: SERIF_BOLD, size: 13, color: SLIP_INK, align: 'right' });

  // ── Identité du salarié (à gauche) et cadre du salarié (à droite)
  let top = Math.max(leftEnd, 112) + 18;
  const identity: Array<[string, string]> = [
    ['Matricule', staff.employeeNumber || '—'],
    ['N° S.S.', staff.socialSecurityNumber || '—'],
    ['Emploi', staff.jobTitle || staff.roles.join(', ') || '—'],
  ];
  if (staff.hireDate) {
    identity.push(['Entrée', isoDateText(staff.hireDate)]);
    const seniority = seniorityText(staff.hireDate, slip.period);
    if (seniority) identity.push(['Ancienneté', seniority]);
  }
  let ly = top;
  for (const [label, value] of identity) {
    doc.font(SERIF).fontSize(10.5).fillColor(SLIP_INK).text(`${label} : `, M, ly, { lineBreak: false });
    const labelWidth = doc.widthOfString(`${label} : `);
    fitText(doc, pdfSafe(value), M + labelWidth, ly, 250 - labelWidth, { font: SERIF_BOLD, size: 10.5, minSize: 8, color: SLIP_INK });
    ly += 15;
  }

  const boxX = 318;
  const boxW = W - M - boxX;
  const boxH = Math.max(76, ly - top);
  doc.roundedRect(boxX, top - 6, boxW, boxH + 6, 8).lineWidth(0.9).strokeColor(SLIP_RULE).stroke();
  const nameHeight = paragraph(doc, pdfSafe(staff.fullName), boxX + 14, top + 6, boxW - 28, { font: SERIF_BOLD, size: 12.5, color: SLIP_INK, maxLines: 2 });
  const where = pdfSafe(staff.address) || pdfSafe(staff.phone);
  if (where) paragraph(doc, where, boxX + 14, top + 12 + nameHeight, boxW - 28, { font: SERIF, size: 10, color: SLIP_INK, maxLines: 3, lineGap: 1.5 });
  top = Math.max(ly, top - 6 + boxH + 6) + 16;

  // ── Tableau des éléments de paie
  doc.font(SERIF_ITALIC).fontSize(8.5).fillColor(SLIP_MUTED).text(`Montants exprimés en ${pdfSafe(data.isoCode)}`, M, top, { width: CW, align: 'right', lineBreak: false });
  top += 13;

  const rows: SlipRow[] = [];
  rows.push({ label: 'Salaire de base', pay: plainAmount(slip.baseSalary) });
  for (const item of slip.allowances) rows.push({ label: item.label, pay: plainAmount(item.amount) });
  rows.push({ label: 'Salaire brut', pay: plainAmount(slip.gross), style: 'bold', ruleAbove: true });
  if (slip.deductions.length > 0) {
    rows.push({ label: 'Retenues', style: 'group' });
    for (const item of slip.deductions) {
      const percent = item.kind === 'PERCENT';
      rows.push({
        label: item.label,
        base: percent ? plainAmount(slip.gross) : undefined,
        rate: percent ? `${(Number(item.value) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %` : undefined,
        deduct: plainAmount(item.amount),
      });
    }
    rows.push({ label: 'Total des retenues', deduct: plainAmount(slip.totalDeductions), style: 'bold', ruleAbove: true });
  }
  rows.push({ label: 'Net à payer', pay: plainAmount(slip.net), style: 'bold', ruleAbove: true });

  let segmentTop = top;
  top = slipTableHead(doc, top);
  for (const row of rows) {
    if (top + SLIP_ROW > SLIP_FOOTER_Y - 14) {
      slipTableFrame(doc, segmentTop, top);
      slipFooter(doc, data);
      doc.addPage();
      segmentTop = slipContinuedHeader(doc, data, slip.period);
      top = slipTableHead(doc, segmentTop);
    }
    slipRowDraw(doc, row, top);
    top += SLIP_ROW;
  }
  slipTableFrame(doc, segmentTop, top);
  top += 20;

  // ── Cumuls et net payé
  if (top + 150 > SLIP_FOOTER_Y) {
    slipFooter(doc, data);
    doc.addPage();
    top = slipContinuedHeader(doc, data, slip.period);
  }
  const gross = BigInt(slip.gross);
  const deducted = BigInt(slip.totalDeductions);
  const net = BigInt(slip.net);
  const ytd = data.yearToDate ?? { gross, deductions: deducted, net };
  const sumCols = [
    { title: '', w: 66 },
    { title: 'Brut', w: 78 },
    { title: 'Total retenues', w: 84 },
    { title: 'Net', w: 78 },
  ];
  const sumW = sumCols.reduce((total, col) => total + col.w, 0);
  const sumX = (index: number) => M + sumCols.slice(0, index).reduce((total, col) => total + col.w, 0);
  const sumRows: Array<[string, bigint, bigint, bigint]> = [
    ['Mensuel', gross, deducted, net],
    ['Annuel', ytd.gross, ytd.deductions, ytd.net],
  ];
  doc.rect(M, top, sumW, 20 + 2 * SLIP_ROW).lineWidth(0.9).strokeColor(SLIP_RULE).stroke();
  doc.moveTo(M, top + 20).lineTo(M + sumW, top + 20).lineWidth(0.9).strokeColor(SLIP_RULE).stroke();
  sumCols.forEach((col, index) => {
    if (index > 0) doc.moveTo(sumX(index), top).lineTo(sumX(index), top + 20 + 2 * SLIP_ROW).lineWidth(0.5).strokeColor(SLIP_SOFT).stroke();
    if (col.title) fitText(doc, col.title, sumX(index) + 3, top + 5.5, col.w - 6, { font: SERIF_BOLD, size: 10, color: SLIP_INK, align: 'center' });
  });
  sumRows.forEach((row, rowIndex) => {
    const y = top + 20 + rowIndex * SLIP_ROW + 4.5;
    fitText(doc, row[0], sumX(0) + 8, y, sumCols[0].w - 12, { font: SERIF_BOLD, size: 10, color: SLIP_INK });
    for (let index = 1; index <= 3; index++) {
      fitText(doc, plainAmount(row[index] as bigint), sumX(index) + 3, y, sumCols[index].w - 10, {
        font: SERIF,
        size: 10,
        minSize: 7,
        color: SLIP_INK,
        align: 'right',
      });
    }
  });
  fitText(doc, "Annuel : cumul des bulletins de l'année, de janvier à cette période.", M, top + 20 + 2 * SLIP_ROW + 5, sumW + 20, {
    font: SERIF_ITALIC,
    size: 8,
    minSize: 6.5,
    color: SLIP_MUTED,
  });

  // Net payé, en gros, à droite
  const payX = M + sumW + 28;
  const payW = W - M - payX;
  fitText(doc, 'Net payé', payX, top + 2, payW, { font: SERIF_ITALIC, size: 11, color: SLIP_INK, align: 'right' });
  fitText(doc, `${plainAmount(data.amount)} ${pdfSafe(data.isoCode)}`, payX, top + 18, payW, { font: SERIF_BOLD, size: 22, minSize: 12, color: SLIP_INK, align: 'right' });
  const method = METHOD_LABELS[data.paymentMethod] ?? data.paymentMethod;
  const payment =
    data.status === 'PAID'
      ? `Paiement${data.processedAt ? ` le ${dateText(data.processedAt, data.timeZone)}` : ''} par ${pdfSafe(method)}`
      : data.status === 'FAILED'
        ? 'Paiement annulé'
        : `Paiement en cours par ${pdfSafe(method)}`;
  fitText(doc, payment, payX, top + 50, payW, { font: SERIF, size: 9.5, minSize: 7, color: SLIP_INK, align: 'right' });
  fitText(doc, `Compte ${pdfSafe(method)} ${pdfSafe(data.beneficiaryPhoneMasked)}`, payX, top + 64, payW, { font: SERIF, size: 8.5, minSize: 7, color: SLIP_MUTED, align: 'right' });
  if (data.paymentRef) {
    fitText(doc, `Réf. ${pdfSafe(data.paymentRef)}`, payX, top + 77, payW, { font: SERIF, size: 8.5, minSize: 7, color: SLIP_MUTED, align: 'right' });
  }

  const words = `${capitalizeFirst(amountInWords(data.amount))} ${pdfSafe(data.isoCode === 'GNF' ? 'francs guinéens' : data.isoCode === 'XOF' ? 'francs CFA' : data.isoCode)}`;
  paragraph(doc, `Net payé arrêté à la somme de : ${words}.`, M, top + 20 + 2 * SLIP_ROW + 26, CW, { font: SERIF_ITALIC, size: 9.5, color: SLIP_INK, maxLines: 2 });
  slipFooter(doc, data);
}

// ─── Les mises en page ────────────────────────────────────────────────────────────────────────────────────────────────────────

function bonusReceipt(doc: Doc, data: ExpenseDocumentData, y: number): number {
  const staff = data.details.staff;
  if (!staff) throw new Error('Reçu de prime sans identité.');
  let top = sectionTitle(doc, 'Bénéficiaire de la prime', M, y, CW);
  const half = (CW - 20) / 2;
  let left = top;
  let right = top;
  left += field(doc, 'Nom et prénoms', staff.fullName, M, left, half);
  left += field(doc, 'Emploi', staff.jobTitle ?? staff.roles.join(', '), M, left, half);
  right += field(doc, 'Matricule', staff.employeeNumber, M + half + 20, right, half);
  right += field(doc, 'Téléphone', staff.phone, M + half + 20, right, half);
  top = Math.max(left, right) + 6;

  top = sectionTitle(doc, 'Objet', M, top, CW);
  top += paragraph(doc, data.details.reason ?? '', M, top, CW, { font: 'Helvetica', size: 10.5, color: COLORS.ink, maxLines: 5, lineGap: 3 }) + 22;
  top = amountBox(doc, data, 'Montant de la prime', top);
  top = paymentBlock(doc, data, top);
  return signatures(doc, data, top + 4, "L'employeur", 'Le bénéficiaire (lu et approuvé)');
}

function purchaseInvoice(doc: Doc, data: ExpenseDocumentData, y: number, note: string): number {
  const supplier = data.details.supplier;
  let top = sectionTitle(doc, 'Fournisseur', M, y, CW);
  const half = (CW - 20) / 2;
  let left = top;
  let right = top;
  left += field(doc, 'Raison sociale / nom', supplier?.name, M, left, half);
  left += field(doc, 'Adresse', supplier?.address, M, left, half);
  right += field(doc, 'Téléphone', supplier?.phone, M + half + 20, right, half);
  right += field(doc, 'Référence de la facture du fournisseur', supplier?.invoiceRef, M + half + 20, right, half);
  top = Math.max(left, right) + 4;
  top += field(doc, 'Nature de l’achat', data.categoryText, M, top, CW);

  top = linesTable(doc, data, top, 'Détail des achats', note);
  if (top + 86 + 120 + 96 > FOOTER_Y) top = nextPage(doc, data, note);
  top = amountBox(doc, data, 'Total à payer', top);
  if (data.details.reason) {
    top = sectionTitle(doc, 'Observations', M, top, CW);
    top += paragraph(doc, data.details.reason, M, top, CW, { font: 'Helvetica', size: 9.5, color: COLORS.ink, maxLines: 3, lineGap: 2 }) + 14;
  }
  top = paymentBlock(doc, data, top);
  return signatures(doc, data, top + 4, 'Visa / approbation', 'Réception des biens');
}

function travelNote(doc: Doc, data: ExpenseDocumentData, y: number, note: string): number {
  const travel = data.details.travel;
  let top = sectionTitle(doc, 'Voyage', M, y, CW);
  const half = (CW - 20) / 2;
  let left = top;
  let right = top;
  left += field(doc, 'Voyageur', travel?.traveler, M, left, half);
  left += field(doc, 'Trajet', `${travel?.from ?? ''} → ${travel?.to ?? ''}`, M, left, half);
  const dates = [travel?.departureDate, travel?.returnDate].filter(Boolean).map((d) => isoDateText(d));
  right += field(doc, dates.length > 1 ? 'Dates (aller · retour)' : 'Date', dates.join('  ·  '), M + half + 20, right, half);
  right += field(doc, 'But du voyage', travel?.purpose, M + half + 20, right, half);
  top = Math.max(left, right) + 4;

  if ((data.details.lines ?? []).length > 0) top = linesTable(doc, data, top, 'Détail des frais', note);
  if (top + 86 + 120 + 96 > FOOTER_Y) top = nextPage(doc, data, note);
  top = amountBox(doc, data, 'Total des frais', top);
  top = paymentBlock(doc, data, top);
  return signatures(doc, data, top + 4, 'Le voyageur', 'Approbation');
}

function expenseVoucher(doc: Doc, data: ExpenseDocumentData, y: number): number {
  let top = sectionTitle(doc, 'Dépense', M, y, CW);
  top += field(doc, 'Motif', data.categoryText, M, top, CW);
  top = sectionTitle(doc, 'Objet', M, top + 2, CW);
  top += paragraph(doc, data.details.reason ?? '', M, top, CW, { font: 'Helvetica', size: 10.5, color: COLORS.ink, maxLines: 6, lineGap: 3 }) + 22;
  top = amountBox(doc, data, 'Montant de la dépense', top);
  top = paymentBlock(doc, data, top);
  return signatures(doc, data, top + 4, 'Demandeur', 'Approbation');
}

/** Rend la pièce du retrait en PDF. */
export async function renderExpenseDocument(data: ExpenseDocumentData): Promise<Buffer> {
  const info = EXPENSE_CATEGORIES[data.category];
  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: true,
    info: { Title: `${info.documentTitle} ${data.documentNumber}`, Subject: data.categoryText, Author: data.company.name || "Occa'Z", Creator: "Occa'Z" },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const supplierNote =
    "Document interne établi par Occa'Z pour la comptabilité : il ne remplace pas la facture ou le reçu remis par le fournisseur, à conserver avec cette pièce.";
  const travelNoteText =
    "Document interne établi par Occa'Z pour la comptabilité : les justificatifs des frais (billets, reçus) sont à conserver avec cette pièce.";
  if (data.category === 'SALARY') {
    // Le bulletin a sa propre mise en page (sans bandeau de couleur) et son propre pied de page.
    payslipDocument(doc, data);
    doc.end();
    return done;
  }
  let footerNote: string | null = null;
  const y = header(doc, data, false);

  switch (data.category) {
    case 'BONUS':
      bonusReceipt(doc, data, y);
      break;
    case 'SUPPLIES':
    case 'OFFICE_EQUIPMENT':
      footerNote = supplierNote;
      purchaseInvoice(doc, data, y, supplierNote);
      break;
    case 'TRAVEL':
      footerNote = travelNoteText;
      travelNote(doc, data, y, travelNoteText);
      break;
    default:
      expenseVoucher(doc, data, y);
  }
  footer(doc, data, footerNote);
  doc.end();
  return done;
}