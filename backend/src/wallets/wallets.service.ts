// backend/src/wallets/wallets.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationType,
  Prisma,
  WalletTransactionStatus,
  WalletTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { toMoneyBigInt, formatMoney } from '../common/utils/money.util';

type BalanceField = 'balance' | 'pendingBalance';

/**
 * Toute écriture passe par une des méthodes ci-dessous, jamais par un
 * `prisma.wallet.update` direct ailleurs dans le code — c'est la règle
 * posée Partie VII / section 16 (ledger immuable + verrou optimiste).
 * Chaque méthode gère sa propre transaction : les appelants (Payments,
 * Payouts) enchaînent des appels séquentiels plutôt que d'imbriquer une
 * transaction Prisma commune à travers les services, pour rester simple.
 * En cas de forte contention sur un même portefeuille, le conflit de
 * version fait échouer l'appel avec un 409 — l'appelant peut réessayer.
 */
@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async findByDriverId(driverId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { driverId } });
    if (!wallet) throw new NotFoundException('Portefeuille introuvable.');
    return wallet;
  }

  async findOne(id: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id } });
    if (!wallet) throw new NotFoundException('Portefeuille introuvable.');
    return wallet;
  }

  async getTransactions(
    walletId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const where = { walletId };
    const [data, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /**
   * Écriture atomique avec verrou optimiste : relit la version courante,
   * tente la mise à jour conditionnée à cette version. Un conflit
   * (quelqu'un d'autre a écrit entre-temps) renvoie 409 plutôt que de
   * silencieusement écraser une écriture concurrente.
   */
  private async applyDelta(
    walletId: string,
    field: BalanceField,
    delta: bigint,
    entry: {
      type: WalletTransactionType;
      status?: WalletTransactionStatus;
      bookingId?: string;
      shipmentId?: string;
      payoutId?: string;
      externalReference?: string;
      paymentReference?: string;
      metadata?: Prisma.InputJsonValue;
      triggeredByUserId?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });

      const result = await tx.wallet.updateMany({
        where: { id: walletId, version: wallet.version },
        data: { [field]: { increment: delta }, version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw new ConflictException('Conflit de version sur le portefeuille, veuillez réessayer.');
      }

      return tx.walletTransaction.create({
        data: {
          walletId,
          type: entry.type,
          status: entry.status ?? WalletTransactionStatus.COMPLETED,
          amount: delta,
          currencyId: wallet.currencyId,
          bookingId: entry.bookingId,
          shipmentId: entry.shipmentId,
          payoutId: entry.payoutId,
          externalReference: entry.externalReference,
          paymentReference: entry.paymentReference,
          metadata: entry.metadata,
          triggeredByUserId: entry.triggeredByUserId,
        },
      });
    });
  }

  /**
   * Paiement capturé : les fonds sont "tenus" (pendingBalance), pas
   * encore disponibles — ils ne le deviennent qu'à la fin de la
   * prestation validée par OTP (releaseHeldFunds, appelé au Lot 6). Deux
   * lignes de ledger distinctes (revenu brut, puis commission) plutôt
   * qu'un seul montant net, pour un historique auditable (section 16).
   */
  async holdBookingRevenue(params: {
    driverId: string;
    bookingId: string;
    grossAmount: bigint;
    commission: bigint;
  }) {
    const wallet = await this.findByDriverId(params.driverId);
    await this.applyDelta(wallet.id, 'pendingBalance', params.grossAmount, {
      type: WalletTransactionType.BOOKING_REVENUE,
      status: WalletTransactionStatus.PENDING,
      bookingId: params.bookingId,
    });
    await this.applyDelta(wallet.id, 'pendingBalance', -params.commission, {
      type: WalletTransactionType.COMMISSION,
      status: WalletTransactionStatus.PENDING,
      bookingId: params.bookingId,
    });
  }

  async holdShipmentRevenue(params: {
    driverId: string;
    shipmentId: string;
    grossAmount: bigint;
    commission: bigint;
  }) {
    const wallet = await this.findByDriverId(params.driverId);
    await this.applyDelta(wallet.id, 'pendingBalance', params.grossAmount, {
      type: WalletTransactionType.SHIPMENT_REVENUE,
      status: WalletTransactionStatus.PENDING,
      shipmentId: params.shipmentId,
    });
    await this.applyDelta(wallet.id, 'pendingBalance', -params.commission, {
      type: WalletTransactionType.COMMISSION,
      status: WalletTransactionStatus.PENDING,
      shipmentId: params.shipmentId,
    });
  }

  /**
   * À appeler par le Lot 6 quand l'OTP de fin de prestation confirme
   * COMPLETED : déplace le montant net des entrées PENDING liées vers le
   * solde disponible et les marque COMPLETED.
   */
  async releaseHeldFunds(params: { driverId: string; bookingId?: string; shipmentId?: string }) {
    const wallet = await this.findByDriverId(params.driverId);
    const pending = await this.prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        status: WalletTransactionStatus.PENDING,
        bookingId: params.bookingId,
        shipmentId: params.shipmentId,
      },
    });
    if (pending.length === 0) return;

    const netAmount: bigint = pending.reduce((sum: bigint, t: { amount: bigint }) => sum + t.amount, 0n);

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.walletTransaction.updateMany({
        where: { id: { in: pending.map((t) => t.id) } },
        data: { status: WalletTransactionStatus.COMPLETED },
      });
      const freshWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const result = await tx.wallet.updateMany({
        where: { id: wallet.id, version: freshWallet.version },
        data: {
          pendingBalance: { decrement: netAmount },
          balance: { increment: netAmount },
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        throw new ConflictException('Conflit de version sur le portefeuille, veuillez réessayer.');
      }
    });

    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: params.driverId },
      select: { userId: true },
    });
    if (driver) {
      await this.notifications.notify({
        userId: driver.userId,
        type: NotificationType.DRIVER_PAYMENT,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Paiement reçu',
        fallbackBody: `${formatMoney(netAmount)} ont été ajoutés à votre solde disponible.`,
      });
    }
  }

  /**
   * Annulation avant la fin de la prestation : les entrées PENDING liées
   * sont reversées (le chauffeur n'a rien fait, il ne touche rien) et
   * une écriture REFUND compensatoire réduit pendingBalance d'autant.
   * Appelé par PaymentsService en réaction à BOOKING_CANCELLED /
   * SHIPMENT_CANCELLED (voir common/events/domain-events.ts).
   */
  async reverseHeldFunds(params: {
    driverId: string;
    bookingId?: string;
    shipmentId?: string;
    reason: string;
  }) {
    const wallet = await this.findByDriverId(params.driverId);
    const pending = await this.prisma.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
        status: WalletTransactionStatus.PENDING,
        bookingId: params.bookingId,
        shipmentId: params.shipmentId,
      },
    });
    if (pending.length === 0) return;

    const netAmount: bigint = pending.reduce((sum: bigint, t: { amount: bigint }) => sum + t.amount, 0n);

    await this.prisma.walletTransaction.updateMany({
      where: { id: { in: pending.map((t) => t.id) } },
      data: { status: WalletTransactionStatus.REVERSED },
    });

    await this.applyDelta(wallet.id, 'pendingBalance', -netAmount, {
      type: WalletTransactionType.REFUND,
      bookingId: params.bookingId,
      shipmentId: params.shipmentId,
      metadata: { reason: params.reason },
    });
  }

  /**
   * Ajustement manuel (WALLET_ADJUST) — corrections exceptionnelles par
   * le responsable financier, toujours motivées et tracées.
   */
  async adjustBalance(driverId: string, amountStr: string, reason: string, actorId: string) {
    const wallet = await this.findByDriverId(driverId);
    const amount = toMoneyBigInt(amountStr.replace('-', '')) * (amountStr.startsWith('-') ? -1n : 1n);
    const transaction = await this.applyDelta(wallet.id, 'balance', amount, {
      type: WalletTransactionType.ADJUSTMENT,
      metadata: { reason },
      triggeredByUserId: actorId,
    });
    await this.audit.log({
      actorId,
      entityType: 'Wallet',
      entityId: wallet.id,
      action: 'ADJUST',
      diff: { amount: amountStr, reason },
    });
    return transaction;
  }

  // -----------------------------------------------------------------------
  // Retraits (Payout) — utilisées exclusivement par PayoutsService, pour
  // que WalletsService reste le seul point d'écriture sur Wallet.balance
  // et Wallet.pendingBalance (règle posée en tête de ce fichier).
  // -----------------------------------------------------------------------

  /**
   * Réserve les fonds pour un retrait demandé : bascule balance ->
   * pendingBalance. Échoue proprement si le solde est insuffisant, sans
   * jamais laisser un solde négatif.
   */
  async reserveForPayout(driverId: string, amount: bigint, payoutId: string) {
    const wallet = await this.findByDriverId(driverId);
    if (wallet.balance < amount) {
      throw new BadRequestException('Solde insuffisant pour ce retrait.');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      if (fresh.balance < amount) {
        throw new BadRequestException('Solde insuffisant pour ce retrait.');
      }
      const result = await tx.wallet.updateMany({
        where: { id: wallet.id, version: fresh.version },
        data: {
          balance: { decrement: amount },
          pendingBalance: { increment: amount },
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        throw new ConflictException('Conflit de version sur le portefeuille, veuillez réessayer.');
      }
      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.PAYOUT,
          status: WalletTransactionStatus.PENDING,
          amount: -amount,
          currencyId: wallet.currencyId,
          payoutId,
        },
      });
    });
  }

  /** Retrait effectivement versé : retire le montant du pendingBalance (l'argent a quitté la plateforme). */
  async finalizePayout(driverId: string, amount: bigint, payoutId: string): Promise<void> {
    const wallet = await this.findByDriverId(driverId);
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const result = await tx.wallet.updateMany({
        where: { id: wallet.id, version: fresh.version },
        data: { pendingBalance: { decrement: amount }, version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw new ConflictException('Conflit de version sur le portefeuille, veuillez réessayer.');
      }
      await tx.walletTransaction.updateMany({
        where: { payoutId, status: WalletTransactionStatus.PENDING },
        data: { status: WalletTransactionStatus.COMPLETED },
      });
    });
  }

  /** Retrait échoué côté prestataire : restaure les fonds vers le solde disponible. */
  async reversePayout(driverId: string, amount: bigint, payoutId: string): Promise<void> {
    const wallet = await this.findByDriverId(driverId);
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const fresh = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const result = await tx.wallet.updateMany({
        where: { id: wallet.id, version: fresh.version },
        data: {
          pendingBalance: { decrement: amount },
          balance: { increment: amount },
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        throw new ConflictException('Conflit de version sur le portefeuille, veuillez réessayer.');
      }
      await tx.walletTransaction.updateMany({
        where: { payoutId, status: WalletTransactionStatus.PENDING },
        data: { status: WalletTransactionStatus.REVERSED },
      });
    });
  }
}
