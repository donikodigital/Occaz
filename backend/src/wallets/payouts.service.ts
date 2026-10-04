// backend/src/wallets/payouts.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PayoutStatus, Prisma } from '@prisma/client';
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
    /** Filtre de portée par pays (CountryScopeService) ; absent = aucune restriction. */
    scopeWhere?: Prisma.PayoutWhereInput,
  ): Promise<PaginatedResult<unknown>> {
    const baseWhere = { status: filters.status };
    const where = scopeWhere ? { AND: [baseWhere, scopeWhere] } : baseWhere;
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

  /**
   * Un retrait ne se clôture qu'UNE fois : on « réclame » le statut avant de toucher au solde. Sans cela, un
   * double clic ou un rejeu ferait décompter deux fois le solde en attente, et un « échec » enregistré après un
   * « payé » remettrait au conducteur un argent déjà viré.
   */
  private async claimOpenPayout(id: string, next: PayoutStatus, extra: Prisma.PayoutUpdateManyMutationInput = {}) {
    const claimed = await this.prisma.payout.updateMany({
      where: { id, status: { in: [PayoutStatus.REQUESTED, PayoutStatus.PROCESSING] } },
      data: { status: next, ...extra },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Ce retrait est déjà clôturé (payé, échoué ou annulé).');
    }
  }

  async markPaid(id: string, actorId: string) {
    const payout = await this.findOne(id);
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: payout.walletId } });

    await this.claimOpenPayout(id, PayoutStatus.PAID, { processedAt: new Date() });
    try {
      await this.wallets.finalizePayout(wallet.driverId, payout.amount, id);
    } catch (error) {
      // Le solde n'a pas bougé : on rouvre le retrait pour qu'il puisse être retraité.
      await this.prisma.payout.update({ where: { id }, data: { status: payout.status, processedAt: null } });
      throw error;
    }
    const updated = await this.prisma.payout.findUniqueOrThrow({ where: { id } });
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

    await this.claimOpenPayout(id, PayoutStatus.FAILED);
    try {
      await this.wallets.reversePayout(wallet.driverId, payout.amount, id);
    } catch (error) {
      await this.prisma.payout.update({ where: { id }, data: { status: payout.status } });
      throw error;
    }
    const updated = await this.prisma.payout.findUniqueOrThrow({ where: { id } });
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