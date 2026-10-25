// backend/src/accounting/accounting-export.service.ts
// [25/10/2026] v1 — Exports de la comptabilité d'une année : classeur Excel (une feuille de synthèse par devise avec formules, une feuille
// des dépenses payées) et PDF (une page par devise : mois, semestres, année, dépenses par motif).
import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { formatMoneyWithCurrency } from '../common/utils/money.util';
import { COLORS, fitText } from '../tickets/pdf-kit';
import { pdfSafe } from '../tickets/pdf-text';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ORDER } from '../platform-wallet/expense-categories';
import { AccountingBucket, AccountingService, AccountingSummary, CurrencyAccounting, PaidExpenseRow } from './accounting.service';

const NUMBER_FORMAT = '#,##0';
const BASIS_NOTE =
  'Base encaissements / décaissements : commissions libérées (datées du jour de leur inscription au registre), retraits des conducteurs et dépenses ' +
  "de l'administration comptés au jour de leur paiement. Les retraits en cours ne sont pas comptés. Chaque devise est séparée.";

const num = (value: string) => Number(value);

function bucketRowValues(bucket: AccountingBucket): Array<string | number> {
  return [
    bucket.label,
    num(bucket.commissions),
    num(bucket.driverPayouts),
    bucket.driverPayoutCount,
    num(bucket.adminExpenses),
    ...EXPENSE_CATEGORY_ORDER.map((category) => num(bucket.byCategory[category])),
    num(bucket.result),
  ];
}

@Injectable()
export class AccountingExportService {
  constructor(private readonly accounting: AccountingService) {}

  // ─── Excel ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  async excel(year: number, includeStaffNames: boolean): Promise<Buffer> {
    const [summary, expenses] = await Promise.all([this.accounting.summary(year), this.accounting.paidExpenses(year, includeStaffNames)]);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Occa'Z";
    workbook.created = new Date();

    for (const currency of summary.currencies) this.summarySheet(workbook, summary, currency);
    this.expensesSheet(workbook, year, expenses);

    const data = await workbook.xlsx.writeBuffer();
    return Buffer.from(data);
  }

  private summarySheet(workbook: ExcelJS.Workbook, summary: AccountingSummary, currency: CurrencyAccounting) {
    const sheet = workbook.addWorksheet(`Synthèse ${currency.isoCode}`, { views: [{ state: 'frozen', ySplit: 4 }] });
    const categoryHeaders = EXPENSE_CATEGORY_ORDER.map((category) => `Dép. ${EXPENSE_CATEGORIES[category].label}`);
    const headers = ['Période', 'Commissions', 'Versé aux conducteurs', 'Nb paiements conducteurs', "Dépenses de l'administration", ...categoryHeaders, 'Résultat'];
    const lastColumn = headers.length;

    sheet.mergeCells(1, 1, 1, lastColumn);
    sheet.getCell(1, 1).value = `Comptabilité ${summary.year} — ${currency.isoCode}`;
    sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF083A63' } };
    sheet.mergeCells(2, 1, 2, lastColumn);
    sheet.getCell(2, 1).value = BASIS_NOTE;
    sheet.getCell(2, 1).font = { italic: true, size: 9, color: { argb: 'FF5B6B79' } };
    sheet.getCell(2, 1).alignment = { wrapText: true, vertical: 'top' };
    sheet.getRow(2).height = 38;

    const headRow = sheet.getRow(4);
    headers.forEach((text, index) => {
      const cell = headRow.getCell(index + 1);
      cell.value = text;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083A63' } };
      cell.alignment = { horizontal: index === 0 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    });
    headRow.height = 32;

    // Mois : lignes 5 à 16. Semestres et année en formules (SOMME) : un comptable qui corrige une cellule voit les totaux suivre.
    const addRow = (rowNumber: number, values: Array<string | number>, formulas?: Record<number, string>, style?: 'total') => {
      const row = sheet.getRow(rowNumber);
      values.forEach((value, index) => {
        const cell = row.getCell(index + 1);
        const formula = formulas?.[index + 1];
        cell.value = formula ? { formula, result: typeof value === 'number' ? value : 0 } : value;
        if (index > 0) cell.numFmt = NUMBER_FORMAT;
        if (style === 'total') {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF5FB' } };
        }
      });
    };

    currency.months.forEach((bucket, index) => addRow(5 + index, bucketRowValues(bucket)));
    const sumFormulas = (from: number, to: number) => {
      const formulas: Record<number, string> = {};
      for (let column = 2; column <= lastColumn; column += 1) {
        const letter = sheet.getColumn(column).letter;
        formulas[column] = `SUM(${letter}${from}:${letter}${to})`;
      }
      return formulas;
    };
    addRow(18, bucketRowValues(currency.semesters[0]), sumFormulas(5, 10), 'total');
    addRow(19, bucketRowValues(currency.semesters[1]), sumFormulas(11, 16), 'total');
    addRow(20, bucketRowValues(currency.year), sumFormulas(5, 16), 'total');
    // Le résultat de chaque ligne = commissions − dépenses (formule : cohérent même si une cellule est corrigée à la main).
    const resultRows: Array<[number, AccountingBucket]> = [
      ...currency.months.map((bucket, index): [number, AccountingBucket] => [5 + index, bucket]),
      [18, currency.semesters[0]],
      [19, currency.semesters[1]],
      [20, currency.year],
    ];
    for (const [rowNumber, bucket] of resultRows) {
      const cell = sheet.getRow(rowNumber).getCell(lastColumn);
      cell.value = { formula: `B${rowNumber}-E${rowNumber}`, result: num(bucket.result) };
      cell.numFmt = NUMBER_FORMAT;
    }

    sheet.getColumn(1).width = 18;
    for (let column = 2; column <= lastColumn; column += 1) sheet.getColumn(column).width = column === 4 ? 14 : 20;
  }

  private expensesSheet(workbook: ExcelJS.Workbook, year: number, rows: PaidExpenseRow[]) {
    const sheet = workbook.addWorksheet('Dépenses payées', { views: [{ state: 'frozen', ySplit: 3 }] });
    sheet.mergeCells(1, 1, 1, 8);
    sheet.getCell(1, 1).value = `Dépenses de l'administration payées en ${year}`;
    sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF083A63' } };

    const headers = ['Date de paiement', 'N° de pièce', 'Motif', 'Personne / fournisseur / objet', 'Compte débité', 'Devise', 'Montant', 'Référence de la transaction'];
    const head = sheet.getRow(3);
    headers.forEach((text, index) => {
      const cell = head.getCell(index + 1);
      cell.value = text;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF083A63' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    head.height = 28;

    rows.forEach((row, index) => {
      const line = sheet.getRow(4 + index);
      line.getCell(1).value = new Date(row.paidAt);
      line.getCell(1).numFmt = 'dd/mm/yyyy';
      line.getCell(2).value = row.documentNumber ?? '';
      line.getCell(3).value = row.motif;
      line.getCell(4).value = row.subject ?? '';
      line.getCell(5).value = row.beneficiary;
      line.getCell(6).value = row.isoCode;
      line.getCell(7).value = num(row.amount);
      line.getCell(7).numFmt = NUMBER_FORMAT;
      line.getCell(8).value = row.externalReference ?? '';
    });
    [16, 18, 22, 36, 22, 9, 18, 28].forEach((width, index) => (sheet.getColumn(index + 1).width = width));
    if (rows.length > 0) sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + rows.length, column: 8 } };
  }

  // ─── PDF ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  async pdf(year: number): Promise<Buffer> {
    const summary = await this.accounting.summary(year);
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: false,
      info: { Title: `Comptabilité ${year}`, Subject: 'Synthèse comptable annuelle', Author: "Occa'Z", Creator: "Occa'Z" },
    });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    const currencies = summary.currencies.length > 0 ? summary.currencies : [];
    currencies.forEach((currency) => this.pdfPage(doc, summary, currency));
    if (currencies.length === 0) doc.addPage();
    doc.end();
    return done;
  }

  private pdfPage(doc: InstanceType<typeof PDFDocument>, summary: AccountingSummary, currency: CurrencyAccounting) {
    const W = 595.28;
    const H = 841.89;
    const M = 36;
    const CW = W - 2 * M;
    doc.addPage();

    // En-tête
    doc.rect(0, 0, W, 86).fill(COLORS.base);
    doc.save();
    doc.circle(W - 30, 0, 110).fillOpacity(0.16).fill(COLORS.deep);
    doc.restore();
    doc.rect(0, 86, W, 4).fill(COLORS.gold);
    fitText(doc, "Occa'Z", M, 22, 200, { font: 'Helvetica-Bold', size: 24, color: COLORS.white });
    fitText(doc, 'Synthèse comptable', M, 54, 260, { font: 'Helvetica', size: 10, color: '#BFE6FA' });
    fitText(doc, `Année ${summary.year}`, W - M - 220, 22, 220, { font: 'Helvetica-Bold', size: 18, color: COLORS.white, align: 'right' });
    fitText(doc, `Devise : ${pdfSafe(currency.isoCode)}`, W - M - 220, 50, 220, { font: 'Helvetica', size: 11, color: '#BFE6FA', align: 'right' });

    const money = (value: string) => pdfSafe(formatMoneyWithCurrency(value, ''));
    const col = { label: M + 8, commissions: M + 110, payouts: M + 220, expenses: M + 330, result: M + 430 };
    const colWidth = 95;

    let y = 108;
    const head = () => {
      doc.rect(M, y, CW, 22).fill(COLORS.deep);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white);
      doc.text('PÉRIODE', col.label, y + 8, { lineBreak: false });
      doc.text('COMMISSIONS', col.commissions, y + 8, { width: colWidth, align: 'right', lineBreak: false });
      doc.text('VERSÉ AUX CONDUCTEURS', col.payouts - 12, y + 8, { width: colWidth + 12, align: 'right', lineBreak: false });
      doc.text('DÉPENSES ADMIN.', col.expenses, y + 8, { width: colWidth, align: 'right', lineBreak: false });
      doc.text('RÉSULTAT', col.result, y + 8, { width: CW - (col.result - M) - 8, align: 'right', lineBreak: false });
      y += 22;
    };
    const line = (bucket: AccountingBucket, options: { strong?: boolean; zebra?: boolean }) => {
      if (options.strong) doc.rect(M, y, CW, 20).fill('#EAF5FB');
      else if (options.zebra) doc.rect(M, y, CW, 20).fill('#F7FBFD');
      const font = options.strong ? 'Helvetica-Bold' : 'Helvetica';
      fitText(doc, pdfSafe(bucket.label), col.label, y + 6, 100, { font, size: 8.5, minSize: 7, color: COLORS.ink });
      fitText(doc, money(bucket.commissions), col.commissions, y + 6, colWidth, { font, size: 8.5, minSize: 6.5, color: COLORS.ink, align: 'right' });
      fitText(doc, money(bucket.driverPayouts), col.payouts, y + 6, colWidth, { font, size: 8.5, minSize: 6.5, color: COLORS.ink, align: 'right' });
      fitText(doc, money(bucket.adminExpenses), col.expenses, y + 6, colWidth, { font, size: 8.5, minSize: 6.5, color: COLORS.ink, align: 'right' });
      const negative = bucket.result.startsWith('-');
      fitText(doc, money(bucket.result), col.result, y + 6, CW - (col.result - M) - 8, {
        font: 'Helvetica-Bold',
        size: 8.5,
        minSize: 6.5,
        color: negative ? '#9B1C1C' : '#17663A',
        align: 'right',
      });
      y += 20;
    };

    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.base).text('PAR MOIS', M, y - 2, { lineBreak: false, characterSpacing: 1 });
    y += 12;
    head();
    currency.months.forEach((bucket, index) => line(bucket, { zebra: index % 2 === 0 }));
    y += 8;
    currency.semesters.forEach((bucket) => line(bucket, { strong: true }));
    line(currency.year, { strong: true });

    // Dépenses par motif
    y += 18;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.base).text("DÉPENSES DE L'ADMINISTRATION PAR MOTIF (ANNÉE)", M, y, { lineBreak: false, characterSpacing: 1 });
    y += 14;
    EXPENSE_CATEGORY_ORDER.forEach((category, index) => {
      if (index % 2 === 0) doc.rect(M, y, CW, 18).fill('#F7FBFD');
      fitText(doc, pdfSafe(EXPENSE_CATEGORIES[category].label), col.label, y + 5, 220, { font: 'Helvetica', size: 8.5, color: COLORS.ink });
      fitText(doc, money(currency.year.byCategory[category]), col.expenses - 60, y + 5, colWidth + 60 + (col.result - col.expenses) , {
        font: 'Helvetica',
        size: 8.5,
        minSize: 6.5,
        color: COLORS.ink,
        align: 'right',
      });
      y += 18;
    });

    // Pied de page
    doc.font('Helvetica-Oblique').fontSize(6.8).fillColor(COLORS.muted).text(pdfSafe(BASIS_NOTE), M, H - 52, { width: CW, lineGap: 1 });
    doc
      .font('Helvetica')
      .fontSize(6.8)
      .fillColor(COLORS.muted)
      .text(`Édité le ${new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Conakry' }).format(new Date())}`, M, H - 22, {
        width: CW,
        align: 'right',
        lineBreak: false,
      });
  }
}
