// backend/src/platform-wallet/expense-document.service.ts
// [25/10/2026] v2 — Bulletin de salaire : cumul annuel (« Annuel ») calculé avec les bulletins déjà établis de la même personne.
// [25/10/2026] v1 — Produit le PDF (bulletin, facture, reçu…) d'un retrait de la plateforme depuis les données figées à la création.
// Identité de l'entreprise : réglages « company.name », « company.address », « company.phone », « company.email », « company.registration »
// (Paramètres de la plateforme) ; à défaut, « Occa'Z ».
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, type PlatformWithdrawal } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import type { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { EXPENSE_CATEGORIES, expenseCategoryText, type StoredExpenseDetails } from './expense-categories';
import { ExpenseDocumentData, renderExpenseDocument } from './expense-document.pdf';

const COMPANY_KEYS = ['company.name', 'company.address', 'company.phone', 'company.email', 'company.registration'] as const;
const TIME_ZONE = 'Africa/Conakry';

/** Numéro masqué : « ••••4417 » (le PDF circule : jamais le numéro entier). */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 4 ? `****${digits.slice(-4)}` : '****';
}

/** Les pièces d'une personne (salaire, prime) contiennent des données personnelles : droit de gérer le portefeuille exigé. */
export function canSeeDocument(user: AuthenticatedUser, category: string): boolean {
  if (category !== 'SALARY' && category !== 'BONUS') return true;
  return user.accountType === AccountType.SUPERADMIN || user.permissions.includes(PERMISSIONS.PLATFORM_WALLET_MANAGE);
}

@Injectable()
export class ExpenseDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  private async company(): Promise<ExpenseDocumentData['company']> {
    const rows = await this.prisma.platformSetting.findMany({ where: { key: { in: [...COMPANY_KEYS] } } });
    const read = (key: string): string | undefined => {
      const value = rows.find((row) => row.key === key)?.value;
      return typeof value === 'string' && value.trim() ? value.trim() : undefined;
    };
    return {
      name: read('company.name') ?? "Occa'Z",
      address: read('company.address'),
      phone: read('company.phone'),
      email: read('company.email'),
      registration: read('company.registration'),
    };
  }

  /**
   * Cumul de l'année pour un bulletin : les bulletins SALAIRE de la même personne, dans la même devise, des mois précédents de l'année
   * (hors paiements annulés), plus celui-ci. Un bulletin illisible est ignoré plutôt que de bloquer le téléchargement.
   */
  private async yearToDate(withdrawal: PlatformWithdrawal, details: StoredExpenseDetails): Promise<ExpenseDocumentData['yearToDate']> {
    const slip = details.payslip;
    if (withdrawal.category !== 'SALARY' || !slip || !withdrawal.staffUserId || !withdrawal.periodMonth) return undefined;
    const year = withdrawal.periodMonth.slice(0, 4);
    const earlier = await this.prisma.platformWithdrawal.findMany({
      where: {
        category: 'SALARY',
        staffUserId: withdrawal.staffUserId,
        currencyId: withdrawal.currencyId,
        status: { not: 'FAILED' },
        id: { not: withdrawal.id },
        periodMonth: { gte: `${year}-01`, lt: withdrawal.periodMonth },
      },
      select: { details: true },
    });
    const total = { gross: BigInt(slip.gross), deductions: BigInt(slip.totalDeductions), net: BigInt(slip.net) };
    for (const row of earlier) {
      const other = (row.details as StoredExpenseDetails | null)?.payslip;
      if (!other) continue;
      try {
        const gross = BigInt(other.gross);
        const deductions = BigInt(other.totalDeductions);
        const net = BigInt(other.net);
        total.gross += gross;
        total.deductions += deductions;
        total.net += net;
      } catch {
        // montant illisible : ce mois-là n'est pas compté
      }
    }
    return total;
  }

  async render(withdrawalId: string, user: AuthenticatedUser): Promise<{ buffer: Buffer; filename: string }> {
    const withdrawal = await this.prisma.platformWithdrawal.findUnique({
      where: { id: withdrawalId },
      include: { currency: true, beneficiary: true },
    });
    if (!withdrawal || !withdrawal.documentNumber) {
      throw new NotFoundException("Ce retrait n'a pas de pièce comptable (il date d'avant la mise en place des motifs).");
    }
    if (!canSeeDocument(user, withdrawal.category)) {
      throw new ForbiddenException('Les bulletins de paie et les reçus de prime sont réservés à ceux qui gèrent le portefeuille.');
    }
    const issuer = withdrawal.requestedById
      ? await this.prisma.user.findUnique({ where: { id: withdrawal.requestedById }, select: { email: true, phone: true } })
      : null;

    const details = (withdrawal.details ?? {}) as StoredExpenseDetails;
    const data: ExpenseDocumentData = {
      category: withdrawal.category,
      categoryText: expenseCategoryText(withdrawal.category, withdrawal.categoryLabel),
      documentNumber: withdrawal.documentNumber,
      issuedAt: withdrawal.requestedAt,
      timeZone: TIME_ZONE,
      company: await this.company(),
      amount: withdrawal.amount,
      isoCode: withdrawal.currency.isoCode,
      status: withdrawal.status === 'PAID' ? 'PAID' : withdrawal.status === 'FAILED' ? 'FAILED' : 'PROCESSING',
      processedAt: withdrawal.processedAt,
      periodMonth: withdrawal.periodMonth,
      details,
      beneficiaryName: withdrawal.beneficiary.holderName,
      beneficiaryPhoneMasked: maskPhone(withdrawal.destinationRef),
      paymentMethod: withdrawal.method,
      paymentRef: withdrawal.externalReference,
      issuedBy: issuer?.email ?? issuer?.phone ?? null,
      yearToDate: await this.yearToDate(withdrawal, details),
    };
    const buffer = await renderExpenseDocument(data);
    return { buffer, filename: `${EXPENSE_CATEGORIES[withdrawal.category].fileSlug}-${withdrawal.documentNumber}.pdf` };
  }
}