// backend/src/wallets/payouts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PayoutStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WalletsService } from './wallets.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { toMoneyBigInt } from '../common/utils/money.util';
import { RequestPayoutDto } from './dto/request-payout.dto';

/**
 * N'écrit jamais Wallet.balance/pendingBalance directement — toujours via
 * WalletsService.reserveForPayout / finalizePayout / reversePayout, seul
 * point d'écriture autorisé sur le portefeuille (voir wallets.service.ts).
 */
@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly wallets: WalletsService,
  ) {}

  async findOne(id: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Retrait introuvable.');
    return payout;
  }

  async findMineForDriver(driverId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const wallet = await this.wallets.findByDriverId(driverId);
    const where = { walletId: wallet.id };
    const [data, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.payout.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: PayoutStatus } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = { status: filters.status };
    const [data, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { requestedAt: 'desc' },
        include: { wallet: { include: { driver: true } } },
      }),
      this.prisma.payout.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async request(driverId: string, dto: RequestPayoutDto) {
    const wallet = await this.wallets.findByDriverId(driverId);
    const amount = toMoneyBigInt(dto.amount);

    const payout = await this.prisma.payout.create({
      data: {
        walletId: wallet.id,
        amount,
        currencyId: wallet.currencyId,
        status: PayoutStatus.REQUESTED,
        method: dto.method,
        destinationRef: dto.destinationRef,
      },
    });

    // reserveForPayout valide le solde suffisant et bascule
    // balance -> pendingBalance ; si elle échoue, le Payout créé
    // ci-dessus doit être annulé pour ne pas laisser une demande
    // orpheline sans réservation de fonds derrière elle.
    try {
      await this.wallets.reserveForPayout(driverId, amount, payout.id);
    } catch (error) {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: { status: PayoutStatus.CANCELLED },
      });
      throw error;
    }

    return payout;
  }

  /** Le support/l'équipe finance marque le virement comme initié côté prestataire. */
  async markProcessing(id: string, actorId: string) {
    const payout = await this.findOne(id);
    if (payout.status !== PayoutStatus.REQUESTED) {
      throw new NotFoundException('Ce retrait ne peut pas être marqué en traitement.');
    }
    const updated = await this.prisma.payout.update({
      where: { id },
      data: { status: PayoutStatus.PROCESSING },
    });
    await this.audit.log({
      actorId,
      entityType: 'Payout',
      entityId: id,
      action: 'PROCESSING',
    });
    return updated;
  }

  async markPaid(id: string, actorId: string) {
    const payout = await this.findOne(id);
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: payout.walletId } });

    await this.wallets.finalizePayout(wallet.driverId, payout.amount, id);
    const updated = await this.prisma.payout.update({
      where: { id },
      data: { status: PayoutStatus.PAID, processedAt: new Date() },
    });
    await this.audit.log({
      actorId,
      entityType: 'Payout',
      entityId: id,
      action: 'PAID',
    });
    return updated;
  }

  async markFailed(id: string, reason: string, actorId: string) {
    const payout = await this.findOne(id);
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: payout.walletId } });

    await this.wallets.reversePayout(wallet.driverId, payout.amount, id);
    const updated = await this.prisma.payout.update({
      where: { id },
      data: { status: PayoutStatus.FAILED },
    });
    await this.audit.log({
      actorId,
      entityType: 'Payout',
      entityId: id,
      action: 'FAILED',
      diff: { reason },
    });
    return updated;
  }
}
