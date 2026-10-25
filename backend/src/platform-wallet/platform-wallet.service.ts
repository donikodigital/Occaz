// backend/src/platform-wallet/platform-wallet.service.ts
//
// Portefeuille de la PLATEFORME : permet au SuperAdmin de retirer les commissions encaissées (XOF et GNF) vers des numéros Orange
// Money enregistrés (le sien, ceux du support, du service client…).
//
// Le solde n'est pas stocké — on ne tient pas deux comptabilités. Les commissions sont déjà dans le registre (WalletTransaction de
// type COMMISSION) pour leur statut, et dans Booking/Shipment.platformFee pour leur montant et leur devise de paiement ; pour chaque devise :
//     disponible = commissions libérées (COMPLETED) − retraits payés − retraits en cours
// Les commissions « en attente » (course pas encore terminée, donc remboursable) ne sont pas retirables.
//
// MOTIF : chaque retrait porte un motif (Salaire, Primes, Fonctionnement, Frais de voyage, Fournitures, Équipements de bureau, Autres) qui
// décide de ce qu'il faut saisir et de la PIÈCE comptable produite en PDF (bulletin, reçu, facture d'achat, note de frais, justificatif —
// voir expense-categories.ts / expense-rules.ts / expense-document.pdf.ts). Pour un salaire, le montant EST le net calculé depuis la fiche
// de paie de la personne ; pour une facture, la somme des lignes. L'identité et le bulletin sont FIGÉS dans le retrait.
//
// Sécurité : permission dédiée, CODE À 6 CHIFFRES REÇU PAR E-MAIL à chaque retrait (lié au bénéficiaire, à la devise et au montant — voir withdrawal-code.service.ts), verrou par devise (deux retraits simultanés ne peuvent pas
// dépasser le solde), numéro de destination limité aux bénéficiaires enregistrés, journal d'audit sur chaque action.
//
// Tant que l'adaptateur Orange Money réel n'existe pas, en PRODUCTION le retrait est enregistré « en cours » (le montant est réservé)
// SANS appel au prestataire : le SuperAdmin fait le virement depuis le compte marchand Orange Money, puis clique « Marquer payé ».
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ExpenseCategory,
  NotificationType,
  PlatformWithdrawalStatus,
  Prisma,
  WalletTransactionStatus,
} from '@prisma/client';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WithdrawalCodeService } from './withdrawal-code.service';
import { PayoutProviderRegistry } from '../wallets/providers/payout-provider.registry';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { formatMoneyWithCurrency, toPositiveMoneyBigInt } from '../common/utils/money.util';
import { StaffPayService } from '../accounting/staff-pay.service';
import {
  CreateBeneficiaryDto,
  CreateWithdrawalDto,
  ExpenseMotifDto,
  ListWithdrawalsQueryDto,
  PayslipPreviewQueryDto,
  RequestWithdrawalCodeDto,
  UpdateBeneficiaryDto,
} from './dto/platform-wallet.dto';
import {
  EXPENSE_CATEGORIES,
  expenseCategoryText,
  periodLabel,
  type PayslipSnapshot,
  type StaffSnapshot,
  type StoredExpenseDetails,
} from './expense-categories';
import { formatDocumentNumber, validateExpenseInput, type ExpenseInput, type ValidatedExpense } from './expense-rules';

export interface CurrencyBalance {
  currencyId: string;
  isoCode: string;
  /** Commissions libérées depuis le début. */
  earned: string;
  /** Commissions en attente (course non terminée) : pas encore retirables. */
  pending: string;
  /** Déjà retiré (payé). */
  withdrawn: string;
  /** Retraits envoyés mais pas encore confirmés. */
  inProgress: string;
  /** Ce qu'on peut retirer maintenant. */
  available: string;
}

interface RawBalance {
  earned: bigint;
  pending: bigint;
  withdrawn: bigint;
  inProgress: bigint;
  available: bigint;
}

/** Numéro masqué pour les journaux et les alertes : « ••••4417 ». */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : '••••';
}

/** Un retrait tel que le voit la liste : sans le détail (lignes, identité, bulletin — il sert au PDF), avec de quoi l'afficher. */
function present<T extends { details: Prisma.JsonValue | null; documentNumber: string | null }>(row: T) {
  const { details, ...rest } = row;
  const stored = (details ?? {}) as StoredExpenseDetails;
  return {
    ...rest,
    documentNumber: row.documentNumber,
    hasDocument: !!row.documentNumber,
    /** La personne, le voyageur ou le fournisseur concerné. */
    subject: stored.staff?.fullName ?? stored.travel?.traveler ?? stored.supplier?.name ?? null,
  };
}

interface PreparedExpense {
  validated: ValidatedExpense;
  amount: bigint;
  staff?: StaffSnapshot;
  payslip?: PayslipSnapshot;
}

@Injectable()
export class PlatformWalletService {
  private readonly logger = new Logger(PlatformWalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly providers: PayoutProviderRegistry,
    private readonly codes: WithdrawalCodeService,
    private readonly staffPay: StaffPayService,
  ) {}

  // ─── Solde ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  /**
   * Les commissions viennent du registre des conducteurs POUR LE STATUT (libérée = course terminée, en attente = pas encore), mais le
   * MONTANT et la DEVISE sont ceux de la réservation / de l'envoi d'origine (Booking.platformFee, Shipment.platformFee) : c'est dans cette
   * devise que le client a payé, donc dans cette devise que l'argent est arrivé sur le compte marchand. Le registre, lui, convertit la
   * commission dans la devise du portefeuille du conducteur (trajet payé en XOF, conducteur en GNF) : s'y fier ferait apparaître des GNF
   * qui n'ont jamais été encaissés. C'est aussi la même source que le tableau de bord (Booking/Shipment.platformFee par devise).
   */
  private async computeBalance(client: Prisma.TransactionClient | PrismaService, currencyId: string): Promise<RawBalance> {
    const rows = await client.$queryRaw<{ status: string; total: bigint | null }[]>`
      SELECT wt."status"::text AS "status", SUM(src."platformFee")::bigint AS "total"
      FROM "wallet_transactions" wt
      JOIN (
        SELECT "id", "currencyId", "platformFee" FROM "bookings"
        UNION ALL
        SELECT "id", "currencyId", "platformFee" FROM "shipments"
      ) src ON src."id" = COALESCE(wt."bookingId", wt."shipmentId")
      WHERE wt."type" = 'COMMISSION'
        AND wt."status" IN ('COMPLETED', 'PENDING')
        AND src."currencyId" = ${currencyId}
      GROUP BY wt."status"
    `;
    const sumOf = (status: WalletTransactionStatus) => rows.find((row) => row.status === status)?.total ?? 0n;

    const withdrawal = (status: PlatformWithdrawalStatus) =>
      client.platformWithdrawal.aggregate({ where: { currencyId, status }, _sum: { amount: true } });
    const [paid, processing] = await Promise.all([withdrawal(PlatformWithdrawalStatus.PAID), withdrawal(PlatformWithdrawalStatus.PROCESSING)]);

    const earned = sumOf(WalletTransactionStatus.COMPLETED);
    const pending = sumOf(WalletTransactionStatus.PENDING);
    const withdrawn = paid._sum.amount ?? 0n;
    const inProgress = processing._sum.amount ?? 0n;
    const available = earned - withdrawn - inProgress;
    return { earned, pending, withdrawn, inProgress, available: available > 0n ? available : 0n };
  }

  async getOverview() {
    const currencies = await this.prisma.currency.findMany({ orderBy: { isoCode: 'asc' } });
    const balances: CurrencyBalance[] = [];
    for (const currency of currencies) {
      const b = await this.computeBalance(this.prisma, currency.id);
      balances.push({
        currencyId: currency.id,
        isoCode: currency.isoCode,
        earned: b.earned.toString(),
        pending: b.pending.toString(),
        withdrawn: b.withdrawn.toString(),
        inProgress: b.inProgress.toString(),
        available: b.available.toString(),
      });
    }
    const inProgressCount = await this.prisma.platformWithdrawal.count({ where: { status: PlatformWithdrawalStatus.PROCESSING } });
    return {
      balances,
      inProgressCount,
      providerSimulated: this.providers.get().isSimulated,
      /** Vrai en production tant qu'Orange Money n'est pas branché : le virement se fait à la main, puis « Marquer payé ». */
      manualTransfer: this.isManualTransfer(),
    };
  }

  private isManualTransfer(): boolean {
    return this.providers.get().isSimulated && process.env.NODE_ENV === 'production';
  }

  // ─── Bénéficiaires ────────────────────────────────────────────────────────────────────────────────────────────────────────

  listBeneficiaries() {
    return this.prisma.platformBeneficiary.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }] });
  }

  async createBeneficiary(dto: CreateBeneficiaryDto, actorId: string) {
    const duplicate = await this.prisma.platformBeneficiary.findFirst({
      where: { phone: dto.phone, isActive: true },
      select: { label: true },
    });
    if (duplicate) throw new BadRequestException(`Ce numéro est déjà enregistré (« ${duplicate.label} »).`);

    const created = await this.prisma.platformBeneficiary.create({
      data: {
        label: dto.label.trim(),
        holderName: dto.holderName.trim(),
        kind: dto.kind,
        phone: dto.phone,
        method: dto.method ?? 'orange_money',
        createdById: actorId,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'PlatformBeneficiary',
      entityId: created.id,
      action: 'CREATED',
      diff: { label: created.label, kind: created.kind, phone: maskPhone(created.phone) },
    });
    return created;
  }

  async updateBeneficiary(id: string, dto: UpdateBeneficiaryDto, actorId: string) {
    const existing = await this.prisma.platformBeneficiary.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Bénéficiaire introuvable.');

    if (dto.phone && dto.phone !== existing.phone) {
      const duplicate = await this.prisma.platformBeneficiary.findFirst({
        where: { phone: dto.phone, isActive: true, NOT: { id } },
        select: { label: true },
      });
      if (duplicate) throw new BadRequestException(`Ce numéro est déjà enregistré (« ${duplicate.label} »).`);
    }

    const updated = await this.prisma.platformBeneficiary.update({
      where: { id },
      data: {
        label: dto.label?.trim(),
        holderName: dto.holderName?.trim(),
        kind: dto.kind,
        phone: dto.phone,
        method: dto.method,
        isActive: dto.isActive,
      },
    });
    const diff: Record<string, string | boolean> = {};
    if (dto.label !== undefined && dto.label !== existing.label) diff.label = dto.label;
    if (dto.holderName !== undefined && dto.holderName !== existing.holderName) diff.holderName = dto.holderName;
    if (dto.kind !== undefined && dto.kind !== existing.kind) diff.kind = dto.kind;
    if (dto.phone !== undefined && dto.phone !== existing.phone) {
      diff.phoneFrom = maskPhone(existing.phone);
      diff.phoneTo = maskPhone(dto.phone);
    }
    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) diff.isActive = dto.isActive;
    await this.audit.log({
      actorId,
      entityType: 'PlatformBeneficiary',
      entityId: id,
      action: dto.isActive === false && existing.isActive ? 'DEACTIVATED' : 'UPDATED',
      diff,
    });
    return updated;
  }

  // ─── Retraits ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

  async listWithdrawals(query: ListWithdrawalsQueryDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.PlatformWithdrawalWhereInput = { status: query.status, currencyId: query.currencyId, category: query.category };
    if (query.year) {
      const start = new Date(Date.UTC(query.year, query.month ? query.month - 1 : 0, 1));
      const end = new Date(Date.UTC(query.month ? query.year : query.year + 1, query.month ? query.month : 0, 1));
      where.requestedAt = { gte: start, lt: end };
    }
    const [rows, total] = await Promise.all([
      this.prisma.platformWithdrawal.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { requestedAt: 'desc' },
        include: { currency: true, beneficiary: true },
      }),
      this.prisma.platformWithdrawal.count({ where }),
    ]);
    const requesterIds = Array.from(new Set(rows.map((r) => r.requestedById).filter((v): v is string => !!v)));
    const requesters = requesterIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, email: true, phone: true } })
      : [];
    const byId = new Map(requesters.map((u) => [u.id, u]));
    const data = rows.map((r) => ({ ...present(r), requestedBy: r.requestedById ? (byId.get(r.requestedById) ?? null) : null }));
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /**
   * Étape 1 : envoie par e-mail au SuperAdmin le code qui confirmera CE retrait. Tout est vérifié avant l'envoi (bénéficiaire actif,
   * devise, montant, solde) pour ne jamais envoyer un code qui ne servirait à rien.
   */
  async requestCode(dto: RequestWithdrawalCodeDto, actorId: string) {
    const { amount, beneficiary, currency } = await this.loadWithdrawalTarget(dto.beneficiaryId, dto.currencyId, dto.amount);
    await this.prepareExpense(dto, amount, currency);
    const balance = await this.computeBalance(this.prisma, currency.id);
    if (amount > balance.available) {
      throw new BadRequestException(
        `Solde insuffisant : tu peux retirer au maximum ${formatMoneyWithCurrency(balance.available, currency.isoCode)}.`,
      );
    }
    return this.codes.send(actorId, { beneficiaryId: beneficiary.id, currencyId: currency.id, amount }, { beneficiaryLabel: beneficiary.label, isoCode: currency.isoCode });
  }

  /** Étape 2 : le code reçu par e-mail autorise le retrait (une seule fois, et seulement pour ce bénéficiaire, cette devise et ce montant). */
  async withdraw(dto: CreateWithdrawalDto, actorId: string) {
    const { amount, beneficiary, currency } = await this.loadWithdrawalTarget(dto.beneficiaryId, dto.currencyId, dto.amount);
    // Le motif est vérifié AVANT de consommer le code : une saisie incomplète ne doit pas brûler le code reçu par e-mail.
    const expense = await this.prepareExpense(dto, amount, currency);
    const info = EXPENSE_CATEGORIES[expense.validated.category];
    const motifText = expenseCategoryText(expense.validated.category, expense.validated.categoryLabel);
    await this.codes.consume(actorId, { beneficiaryId: beneficiary.id, currencyId: currency.id, amount }, dto.code);

    // Verrou par devise : le solde est relu et le retrait créé dans la même transaction, derrière un verrou, pour que deux
    // retraits lancés en même temps ne puissent pas dépasser ensemble le solde.
    const withdrawal = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`platform_wallet:${currency.id}`}))`;
      const balance = await this.computeBalance(tx, currency.id);
      if (amount > balance.available) {
        throw new BadRequestException(
          `Solde insuffisant : tu peux retirer au maximum ${formatMoneyWithCurrency(balance.available, currency.isoCode)}.`,
        );
      }
      // Un même salaire ne se verse qu'une fois (relu ici, sous le verrou : deux clics simultanés ne passent pas tous les deux).
      await this.assertSalaryNotPaid(tx, expense.validated);
      const [{ nextval }] = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('platform_document_number_seq') AS "nextval"`;
      const documentNumber = formatDocumentNumber(info.prefix, new Date().getUTCFullYear(), nextval);
      const details: StoredExpenseDetails = { ...expense.validated.details, staff: expense.staff, payslip: expense.payslip };
      return tx.platformWithdrawal.create({
        data: {
          beneficiaryId: beneficiary.id,
          amount,
          currencyId: currency.id,
          status: PlatformWithdrawalStatus.PROCESSING,
          method: beneficiary.method,
          destinationRef: beneficiary.phone,
          note: dto.note?.trim() || null,
          requestedById: actorId,
          category: expense.validated.category,
          categoryLabel: expense.validated.categoryLabel,
          staffUserId: expense.validated.staffUserId,
          periodMonth: expense.validated.periodMonth,
          details: JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue,
          documentNumber,
        },
      });
    });

    const amountText = formatMoneyWithCurrency(amount, currency.isoCode);
    await this.audit.log({
      actorId,
      entityType: 'PlatformWithdrawal',
      entityId: withdrawal.id,
      action: 'REQUESTED',
      diff: {
        amount: amount.toString(),
        currency: currency.isoCode,
        beneficiary: beneficiary.label,
        destination: maskPhone(beneficiary.phone),
        category: expense.validated.category,
        ...(expense.validated.staffUserId ? { staffUserId: expense.validated.staffUserId } : {}),
        ...(withdrawal.documentNumber ? { documentNumber: withdrawal.documentNumber } : {}),
      },
    });

    // En production sans Orange Money branché : rien ne part. Le montant est réservé, le SuperAdmin fait le virement à la main.
    if (this.isManualTransfer()) {
      await this.alert(`Retrait à effectuer : ${amountText}`, `${motifText} — ${amountText} vers ${beneficiary.label} (${maskPhone(beneficiary.phone)}) — à envoyer depuis le compte marchand, puis « Marquer payé ».`);
      return this.findOne(withdrawal.id);
    }

    try {
      const outcome = await this.providers.get().disburse({
        reference: withdrawal.id,
        amount,
        currencyIsoCode: currency.isoCode,
        method: beneficiary.method,
        destination: beneficiary.phone,
      });
      if (outcome.status === 'PAID') {
        await this.close(withdrawal.id, PlatformWithdrawalStatus.PAID, { externalReference: outcome.externalReference }, actorId);
        await this.alert(`Retrait envoyé : ${amountText}`, `${amountText} envoyés à ${beneficiary.label} (${maskPhone(beneficiary.phone)}).`);
      } else if (outcome.status === 'FAILED') {
        await this.close(withdrawal.id, PlatformWithdrawalStatus.FAILED, { failureReason: outcome.reason, externalReference: outcome.externalReference }, actorId);
        await this.alert(`Retrait refusé : ${amountText}`, `Orange Money a refusé le virement vers ${beneficiary.label} : ${outcome.reason}. Le montant est de nouveau disponible.`);
      } else {
        await this.prisma.platformWithdrawal.update({ where: { id: withdrawal.id }, data: { externalReference: outcome.externalReference } });
      }
    } catch (error) {
      // Résultat inconnu (réseau coupé, délai dépassé) : l'argent est peut-être parti. On ne rembourse JAMAIS automatiquement,
      // le retrait reste « en cours » jusqu'à vérification dans le compte marchand.
      this.logger.error(`Retrait plateforme ${withdrawal.id} : résultat inconnu — ${(error as Error).message}`);
      Sentry.captureException(error);
      await this.alert(`Retrait à vérifier : ${amountText}`, `Le résultat du virement vers ${beneficiary.label} est inconnu. Vérifie le compte marchand Orange Money avant de le marquer payé ou échoué.`);
    }
    return this.findOne(withdrawal.id);
  }

  /** Retrait resté « en cours » (virement fait à la main, ou résultat inconnu) : confirmé payé. */
  async markPaid(id: string, externalReference: string | undefined, actorId: string) {
    const withdrawal = await this.findOne(id);
    const closed = await this.close(id, PlatformWithdrawalStatus.PAID, { externalReference: externalReference?.trim() || undefined }, actorId);
    if (!closed) throw new BadRequestException('Ce retrait est déjà clos.');
    await this.alert(
      `Retrait payé : ${formatMoneyWithCurrency(withdrawal.amount, withdrawal.currency.isoCode)}`,
      `Confirmé payé vers ${withdrawal.beneficiary.label} (${maskPhone(withdrawal.destinationRef)}).`,
    );
    return this.findOne(id);
  }

  /** Retrait resté « en cours » qui n'a pas abouti : le montant redevient disponible. */
  async markFailed(id: string, reason: string, actorId: string) {
    const withdrawal = await this.findOne(id);
    const closed = await this.close(id, PlatformWithdrawalStatus.FAILED, { failureReason: reason.trim() }, actorId);
    if (!closed) throw new BadRequestException('Ce retrait est déjà clos.');
    await this.alert(
      `Retrait annulé : ${formatMoneyWithCurrency(withdrawal.amount, withdrawal.currency.isoCode)}`,
      `Le retrait vers ${withdrawal.beneficiary.label} est marqué échoué (${reason.trim()}). Le montant est de nouveau disponible.`,
    );
    return this.findOne(id);
  }

  async findOne(id: string) {
    const withdrawal = await this.prisma.platformWithdrawal.findUnique({ where: { id }, include: { currency: true, beneficiary: true } });
    if (!withdrawal) throw new NotFoundException('Retrait introuvable.');
    return present(withdrawal);
  }

  /** Aperçu du bulletin d'une personne pour un mois : le net à payer remplit le montant du retrait. */
  async payslipPreview(query: PayslipPreviewQueryDto) {
    const result = await this.staffPay.payslipFor(query.staffUserId, query.period);
    const alreadyPaid = await this.findSalaryWithdrawal(this.prisma, query.staffUserId, query.period);
    return {
      staff: { userId: result.staff.userId, fullName: result.staff.fullName, jobTitle: result.staff.jobTitle, roles: result.staff.roles },
      payslip: result.payslip,
      currencyId: result.currencyId,
      isoCode: result.isoCode,
      periodLabel: periodLabel(result.payslip.period),
      /** Numéro de la pièce si ce salaire a déjà été versé (ou est en cours) : l'écran prévient avant d'envoyer. */
      alreadyPaid: alreadyPaid?.documentNumber ?? null,
    };
  }

  // ─── Outils ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

  /** Ferme un retrait « en cours » une seule fois, même si deux requêtes arrivent ensemble ; renvoie faux s'il était déjà clos. */
  private async close(
    id: string,
    status: 'PAID' | 'FAILED',
    data: { externalReference?: string; failureReason?: string },
    actorId: string,
  ): Promise<boolean> {
    const claimed = await this.prisma.platformWithdrawal.updateMany({
      where: { id, status: PlatformWithdrawalStatus.PROCESSING },
      data: { status, processedAt: new Date(), ...data },
    });
    if (claimed.count === 0) return false;
    await this.audit.log({
      actorId,
      entityType: 'PlatformWithdrawal',
      entityId: id,
      action: status,
      diff: { ...(data.externalReference ? { externalReference: data.externalReference } : {}), ...(data.failureReason ? { reason: data.failureReason } : {}) },
    });
    return true;
  }

  private findSalaryWithdrawal(client: Prisma.TransactionClient | PrismaService, staffUserId: string, period: string) {
    return client.platformWithdrawal.findFirst({
      where: {
        category: ExpenseCategory.SALARY,
        staffUserId,
        periodMonth: period,
        status: { in: [PlatformWithdrawalStatus.PROCESSING, PlatformWithdrawalStatus.PAID] },
      },
      select: { documentNumber: true },
    });
  }

  private async assertSalaryNotPaid(client: Prisma.TransactionClient | PrismaService, validated: ValidatedExpense): Promise<void> {
    if (validated.category !== ExpenseCategory.SALARY || !validated.staffUserId || !validated.periodMonth) return;
    const existing = await this.findSalaryWithdrawal(client, validated.staffUserId, validated.periodMonth);
    if (existing) {
      throw new BadRequestException(
        `Le salaire de ${periodLabel(validated.periodMonth)} de cette personne a déjà été versé (pièce ${existing.documentNumber ?? 'existante'}).`,
      );
    }
  }

  /**
   * Vérifie le motif et fixe le montant : salaire → net du bulletin ; facture / frais détaillés → somme des lignes ; sinon, le montant
   * saisi. Si le montant envoyé ne correspond pas à ce que le motif impose, on refuse plutôt que de corriger en silence : le code reçu
   * par e-mail est lié à ce montant.
   */
  private async prepareExpense(
    input: ExpenseMotifDto,
    requestedAmount: bigint,
    currency: { id: string; isoCode: string },
  ): Promise<PreparedExpense> {
    const validated = validateExpenseInput(input as ExpenseInput);
    let amount = requestedAmount;
    let staff: StaffSnapshot | undefined;
    let payslip: PayslipSnapshot | undefined;

    if (validated.category === ExpenseCategory.SALARY) {
      const result = await this.staffPay.payslipFor(validated.staffUserId as string, validated.periodMonth as string);
      if (result.currencyId !== currency.id) {
        throw new BadRequestException(`Le salaire de ${result.staff.fullName} est en ${result.isoCode} : choisis la devise ${result.isoCode}.`);
      }
      await this.assertSalaryNotPaid(this.prisma, validated);
      staff = result.staff;
      payslip = result.payslip;
      amount = BigInt(result.payslip.net);
    } else if (validated.category === ExpenseCategory.BONUS) {
      staff = await this.staffPay.snapshotOf(validated.staffUserId as string);
    } else if (validated.amountFromLines !== null) {
      amount = validated.amountFromLines;
    }

    if (amount !== requestedAmount) {
      const what = validated.category === ExpenseCategory.SALARY ? 'le net à payer du bulletin' : 'le total des lignes';
      throw new BadRequestException(`Le montant doit être égal à ${what} : ${formatMoneyWithCurrency(amount, currency.isoCode)}.`);
    }
    return { validated, amount, staff, payslip };
  }

  private async loadWithdrawalTarget(beneficiaryId: string, currencyId: string, rawAmount: string) {
    const amount = toPositiveMoneyBigInt(rawAmount);
    const [beneficiary, currency] = await Promise.all([
      this.prisma.platformBeneficiary.findUnique({ where: { id: beneficiaryId } }),
      this.prisma.currency.findUnique({ where: { id: currencyId } }),
    ]);
    if (!beneficiary) throw new NotFoundException('Bénéficiaire introuvable.');
    if (!beneficiary.isActive) throw new BadRequestException('Ce bénéficiaire est désactivé : réactive-le ou choisis-en un autre.');
    if (!currency) throw new NotFoundException('Devise introuvable.');
    return { amount, beneficiary, currency };
  }

  private alert(title: string, body: string): Promise<void> {
    return this.notifications.notifyStaff({
      permission: PERMISSIONS.PLATFORM_WALLET_READ,
      type: NotificationType.PAYMENT,
      title,
      body,
      link: '/platform-wallet',
    });
  }
}