// backend/src/deals/deals.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { UpsertDealDto } from './dto/upsert-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

/** Bons plans (contenu éditorial admin, section « Promotions ») — voir PromoCode pour la réduction éventuellement associée. */
@Injectable()
export class DealsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    return Promise.all([
      this.prisma.deal.findMany({ skip: query.skip, take: query.take, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }),
      this.prisma.deal.count(),
    ]).then(([data, total]) => new PaginatedResult(data, total, query.page, query.limit));
  }

  /** Un bon plan est visible côté client s'il est actif et dans sa fenêtre de dates. */
  private visibleWhere(now = new Date()) {
    return {
      isActive: true,
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] }],
    };
  }

  /** Visibles côté client : actifs, dans leur fenêtre de dates, du pays du client s'il est précisé (sinon tous). */
  findActive(countryId?: string) {
    const visible = this.visibleWhere();
    return this.prisma.deal.findMany({
      where: { ...visible, AND: [...visible.AND, ...(countryId ? [{ OR: [{ countryId: null }, { countryId }] }] : [])] },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /** Un bon plan vu par un client : seulement s'il est visible (sinon 404). */
  async findOneActive(id: string) {
    const deal = await this.prisma.deal.findFirst({ where: { id, ...this.visibleWhere() } });
    if (!deal) throw new NotFoundException('Bon plan introuvable.');
    return deal;
  }

  async findOne(id: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id } });
    if (!deal) throw new NotFoundException('Bon plan introuvable.');
    return deal;
  }

  create(dto: UpsertDealDto) {
    return this.prisma.deal.create({
      data: {
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        promoCodeId: dto.promoCodeId,
        countryId: dto.countryId,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateDealDto) {
    await this.findOne(id);
    return this.prisma.deal.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        promoCodeId: dto.promoCodeId,
        countryId: dto.countryId,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.deal.delete({ where: { id } });
  }
}