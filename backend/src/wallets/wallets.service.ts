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
import { ExchangeRateService } from '../pricing/exchange-rate.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { toMoneyBigInt, formatMoney } from '../common/utils/money.util';

type BalanceField = 'balance' | 'pendingBalance';

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly exchangeRates: ExchangeRateService,
  ) {}

  async findByDriverId(driverId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { driverId },
      include: { currency: true },
    });
    if (!wallet) throw new NotFoundException('Portefeuille introuvable.');
    return wallet;
  }

  async findOne(id: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id },
      include: { currency: true },
    });
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
   * `sourceCurrencyId` : devise dans laquelle grossAmount/commission sont
   * exprimés (celle du Booking/Payment) — peut différer de la devise du
   * portefeuille du chauffeur (ex : trajet transfrontalier payé en XOF,
   * chauffeur inscrit en Guinée avec un wallet en GNF). Convertie ici
   * avant tout crédit ; voir ExchangeRateService pour le détail. Cas le
   * plus fréquent (même devise) : aucun appel supplémentaire, aucun
   * changement de comportement.
   */
  async holdBookingRevenue(params: {
    driverId: string;
    bookingId: string;
    grossAmount: bigint;
    commission: bigint;
    sourceCurrencyId: string;
  }) {
    const wallet = await this.findByDriverId(params.driverId);

    const gross = await this.exchangeRates.convert(params.grossAmount, params.sourceCurrencyId, wallet.currencyId);
    await this.applyDelta(wallet.id, 'pendingBalance', gross.amount, {
      type: WalletTransactionType.BOOKING_REVENUE,
      status: WalletTransactionStatus.PENDING,
      bookingId: params.bookingId,
      metadata: gross.conversion ? ({ conversion: gross.conversion } as unknown as Prisma.InputJsonValue) : undefined,
    });

    const commission = await this.exchangeRates.convert(params.commission, params.sourceCurrencyId, wallet.currencyId);
    await this.applyDelta(wallet.id, 'pendingBalance', -commission.amount, {
      type: WalletTransactionType.COMMISSION,
      status: WalletTransactionStatus.PENDING,
      bookingId: params.bookingId,
      metadata: commission.conversion ? ({ conversion: commission.conversion } as unknown as Prisma.InputJsonValue) : undefined,
    });
  }

  async holdShipmentRevenue(params: {
    driverId: string;
    shipmentId: string;
    grossAmount: bigint;
    commission: bigint;
    sourceCurrencyId: string;
  }) {
    const wallet = await this.findByDriverId(params.driverId);

    const gross = await this.exchangeRates.convert(params.grossAmount, params.sourceCurrencyId, wallet.currencyId);
    await this.applyDelta(wallet.id, 'pendingBalance', gross.amount, {
      type: WalletTransactionType.SHIPMENT_REVENUE,
      status: WalletTransactionStatus.PENDING,
      shipmentId: params.shipmentId,
      metadata: gross.conversion ? ({ conversion: gross.conversion } as unknown as Prisma.InputJsonValue) : undefined,
    });

    const commission = await this.exchangeRates.convert(params.commission, params.sourceCurrencyId, wallet.currencyId);
    await this.applyDelta(wallet.id, 'pendingBalance', -commission.amount, {
      type: WalletTransactionType.COMMISSION,
      status: WalletTransactionStatus.PENDING,
      shipmentId: params.shipmentId,
      metadata: commission.conversion ? ({ conversion: commission.conversion } as unknown as Prisma.InputJsonValue) : undefined,
    });
  }

  /**
   * Opère uniquement sur des WalletTransaction déjà enregistrées (donc
   * déjà dans la devise du wallet, la conversion a eu lieu une seule
   * fois à la mise en attente) — aucune conversion à refaire ici.
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