// backend/src/platform-wallet/platform-wallet.service.ts
//
// Portefeuille de la PLATEFORME : permet au SuperAdmin de retirer les commissions encaissées (XOF et GNF) vers des numéros Orange
// Money enregistrés (le sien, ceux du support, du service client…).
//
// Le solde n'est pas stocké — on ne tient pas deux comptabilités. Les commissions sont déjà dans le registre (WalletTransaction de
// type COMMISSION, montant négatif côté conducteur) ; pour chaque devise :
//     disponible = commissions libérées (COMPLETED) − retraits payés − retraits en cours
// Les commissions « en attente » (course pas encore terminée, donc remboursable) ne sont pas retirables.
//
// Sécurité : permission dédiée, mot de passe redemandé à chaque retrait, verrou par devise (deux retraits simultanés ne peuvent pas
// dépasser le solde), numéro de destination limité aux bénéficiaires enregistrés, journal d'audit sur chaque action.
//
// Tant que l'adaptateur Orange Money réel n'existe pas, en PRODUCTION le retrait est enregistré « en cours » (le montant est réservé)
// SANS appel au prestataire : le SuperAdmin fait le virement depuis le compte marchand Orange Money, puis clique « Marquer payé ».
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  NotificationType,
  PlatformWithdrawalStatus,
  Prisma,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as Sentry from '@sentry/nestjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutProviderRegistry } from '../wallets/providers/payout-provider.registry';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { formatMoneyWithCurrency } from '../common/utils/money.util';
import {
  CreateBeneficiaryDto,
  CreateWithdrawalDto,
  ListWithdrawalsQueryDto,
  UpdateBeneficiaryDto,
} from './dto/platform-wallet.dto';

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

@Injectable()
export class PlatformWalletService {
  private readonly logger = new Logger(PlatformWalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly providers: PayoutProviderRegistry,
  ) {}

  // ─── Solde ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

  private async computeBalance(client: Prisma.TransactionClient | PrismaService, currencyId: string): Promise<RawBalance> {
    const commission = (status: WalletTransactionStatus) =>
      client.walletTransaction.aggregate({
        where: { type: WalletTransactionType.COMMISSION, status, currencyId },
        _sum: { amount: true },
      });
    const withdrawal = (status: PlatformWithdrawalStatus) =>
      client.platformWithdrawal.aggregate({ where: { currencyId, status }, _sum: { amount: true } });

    const [done, held, paid, processing] = await Promise.all([
      commission(WalletTransactionStatus.COMPLETED),
      commission(WalletTransactionStatus.PENDING),
      withdrawal(PlatformWithdrawalStatus.PAID),
      withdrawal(PlatformWithdrawalStatus.PROCESSING),
    ]);
    // Le registre des conducteurs porte la commission en négatif (c'est un débit pour eux) : pour la plateforme c'est un gain.
    const earned = -(done._sum.amount ?? 0n);
    const pending = -(held._sum.amount ?? 0n);
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
    const where: Prisma.PlatformWithdrawalWhereInput = { status: query.status, currencyId: query.currencyId };
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
    const data = rows.map((r) => ({ ...r, requestedBy: r.requestedById ? (byId.get(r.requestedById) ?? null) : null }));
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async withdraw(dto: CreateWithdrawalDto, actorId: string) {
    await this.assertPassword(actorId, dto.password);

    const amount = BigInt(dto.amount);
    if (amount <= 0n) throw new BadRequestException('Le montant doit être supérieur à zéro.');

    const [beneficiary, currency] = await Promise.all([
      this.prisma.platformBeneficiary.findUnique({ where: { id: dto.beneficiaryId } }),
      this.prisma.currency.findUnique({ where: { id: dto.currencyId } }),
    ]);
    if (!beneficiary) throw new NotFoundException('Bénéficiaire introuvable.');
    if (!beneficiary.isActive) throw new BadRequestException('Ce bénéficiaire est désactivé : réactive-le ou choisis-en un autre.');
    if (!currency) throw new NotFoundException('Devise introuvable.');

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
        },
      });
    });

    const amountText = formatMoneyWithCurrency(amount, currency.isoCode);
    await this.audit.log({
      actorId,
      entityType: 'PlatformWithdrawal',
      entityId: withdrawal.id,
      action: 'REQUESTED',
      diff: { amount: amount.toString(), currency: currency.isoCode, beneficiary: beneficiary.label, destination: maskPhone(beneficiary.phone) },
    });

    // En production sans Orange Money branché : rien ne part. Le montant est réservé, le SuperAdmin fait le virement à la main.
    if (this.isManualTransfer()) {
      await this.alert(`Retrait à effectuer : ${amountText}`, `${amountText} vers ${beneficiary.label} (${maskPhone(beneficiary.phone)}) — à envoyer depuis le compte marchand, puis « Marquer payé ».`);
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
    return withdrawal;
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

  private async assertPassword(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user?.passwordHash) throw new ForbiddenException('Ce compte n\'a pas de mot de passe : impossible de confirmer un retrait.');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ForbiddenException('Mot de passe incorrect.');
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
