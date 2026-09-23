// backend/src/promo-codes/promo-codes.service.ts
// [23/09/2026] v2 — resolveForCheckout() : exposé pour que BookingsService/ShipmentsService puissent appliquer et consacrer un code promo à la création.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PromoDiscountType, ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { UpsertPromoCodeDto } from './dto/upsert-promo-code.dto';
import { ValidatePromoCodeDto } from './dto/validate-promo-code.dto';

/**
 * Codes promo (section « Promotions »), configurables par l'admin — même
 * esprit que CommissionRule/CancellationPolicy. La réduction elle-même
 * n'est pas encore appliquée automatiquement au montant facturé par
 * ShipmentsService/BookingsService : ce service calcule et valide la
 * réduction, prêt à être branché dans leurs méthodes create()/quote() —
 * une étape volontairement séparée, pour ne pas modifier à la hâte le
 * calcul du prix des réservations et des envois.
 */
@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    return this.paginate({}, query);
  }

  async findOne(id: string) {
    const promoCode = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promoCode) throw new NotFoundException('Code promo introuvable.');
    return promoCode;
  }

  create(dto: UpsertPromoCodeDto) {
    return this.prisma.promoCode.create({
      data: {
        code: dto.code.toUpperCase(),
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        serviceType: dto.serviceType,
        countryId: dto.countryId,
        currencyId: dto.currencyId,
        minAmount: dto.minAmount ? BigInt(dto.minAmount) : undefined,
        maxDiscountAmount: dto.maxDiscountAmount ? BigInt(dto.maxDiscountAmount) : undefined,
        usageLimit: dto.usageLimit,
        usageLimitPerUser: dto.usageLimitPerUser ?? 1,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: Partial<UpsertPromoCodeDto>) {
    await this.findOne(id);
    return this.prisma.promoCode.update({
      where: { id },
      data: {
        code: dto.code?.toUpperCase(),
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        serviceType: dto.serviceType,
        countryId: dto.countryId,
        currencyId: dto.currencyId,
        minAmount: dto.minAmount !== undefined ? BigInt(dto.minAmount) : undefined,
        maxDiscountAmount: dto.maxDiscountAmount !== undefined ? BigInt(dto.maxDiscountAmount) : undefined,
        usageLimit: dto.usageLimit,
        usageLimitPerUser: dto.usageLimitPerUser,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.promoCode.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Vérifie un code et calcule la réduction, SANS la consacrer — utilisé
   * par l'écran « Saisir un code promo » pour afficher l'économie avant
   * paiement. Ne modifie jamais usedCount (voir redeem()).
   */
  async validate(customerId: string, dto: ValidatePromoCodeDto): Promise<{ discountAmount: bigint; finalAmount: bigint }> {
    const amount = BigInt(dto.amount);
    const { discountAmount } = await this.resolveForCheckout(customerId, dto.code, dto.serviceType, amount, dto.countryId);
    const finalAmount = amount > discountAmount ? amount - discountAmount : 0n;
    return { discountAmount, finalAmount };
  }

  /**
   * Utilisé par BookingsService/ShipmentsService à la création d'une
   * réservation ou d'un envoi : vérifie le code (existence, dates, portée,
   * montant minimum, limite d'utilisation par client) et calcule la
   * réduction BRUTE, telle que définie par le code — c'est à l'appelant de
   * la plafonner à sa commission avant de l'appliquer (voir le commentaire
   * dans ShipmentsService.create : la réduction ne doit jamais réduire ce
   * que touche le chauffeur, seulement la commission de la plateforme).
   * Ne consacre rien — l'appelant doit ensuite appeler redeem() dans SA
   * propre transaction, une fois la réservation/l'envoi effectivement créé.
   */
  async resolveForCheckout(
    customerId: string,
    code: string,
    serviceType: ServiceType,
    amount: bigint,
    countryId?: string,
  ): Promise<{ promoCode: Awaited<ReturnType<PromoCodesService['findEligible']>>; discountAmount: bigint }> {
    const promoCode = await this.findEligible(code, serviceType, countryId);

    if (promoCode.minAmount !== null && amount < promoCode.minAmount) {
      throw new BadRequestException(`Montant minimum de ${promoCode.minAmount} requis pour ce code.`);
    }

    const alreadyUsed = await this.prisma.promoCodeRedemption.count({
      where: { promoCodeId: promoCode.id, customerId },
    });
    if (alreadyUsed >= promoCode.usageLimitPerUser) {
      throw new ConflictException('Vous avez déjà utilisé ce code le nombre maximum de fois autorisé.');
    }

    return { promoCode, discountAmount: this.computeDiscount(promoCode, amount) };
  }

  /**
   * Consacre l'utilisation d'un code — à appeler dans la MÊME transaction
   * que la création de la réservation/de l'envoi payé (une fois branché
   * dans BookingsService/ShipmentsService), jamais isolément : c'est ce
   * qui garantit qu'un code n'est jamais compté comme utilisé si le
   * paiement qui l'accompagne échoue. `tx` doit être le client de
   * transaction Prisma de l'appelant.
   */
  async redeem(
    tx: Prisma.TransactionClient,
    promoCode: { id: string; usageLimit: number | null; usedCount: number },
    params: { customerId: string; bookingId?: string; shipmentId?: string; discountAmount: bigint },
  ): Promise<void> {
    // Attribution conditionnelle : si usageLimit est atteint entre la validation
    // et cet appel (deux clients simultanés), la mise à jour ne touche aucune ligne.
    const claimed = await tx.promoCode.updateMany({
      where: {
        id: promoCode.id,
        ...(promoCode.usageLimit !== null ? { usedCount: { lt: promoCode.usageLimit } } : {}),
      },
      data: { usedCount: { increment: 1 } },
    });
    if (claimed.count === 0) {
      throw new ConflictException("Ce code promo n'a plus d'utilisations disponibles.");
    }

    await tx.promoCodeRedemption.create({
      data: {
        promoCodeId: promoCode.id,
        customerId: params.customerId,
        bookingId: params.bookingId,
        shipmentId: params.shipmentId,
        discountAmount: params.discountAmount,
      },
    });
  }

  private async findEligible(code: string, serviceType: ServiceType, countryId?: string) {
    const promoCode = await this.prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });
    if (!promoCode || !promoCode.isActive) {
      throw new NotFoundException('Code promo introuvable ou inactif.');
    }
    const now = new Date();
    if (promoCode.startsAt && promoCode.startsAt > now) {
      throw new BadRequestException("Ce code n'est pas encore actif.");
    }
    if (promoCode.expiresAt && promoCode.expiresAt < now) {
      throw new BadRequestException('Ce code a expiré.');
    }
    if (promoCode.serviceType && promoCode.serviceType !== serviceType) {
      throw new BadRequestException("Ce code ne s'applique pas à ce type de prestation.");
    }
    if (promoCode.countryId && countryId && promoCode.countryId !== countryId) {
      throw new BadRequestException("Ce code n'est pas valable dans ce pays.");
    }
    if (promoCode.usageLimit !== null && promoCode.usedCount >= promoCode.usageLimit) {
      throw new ForbiddenException("Ce code promo n'a plus d'utilisations disponibles.");
    }
    return promoCode;
  }

  private computeDiscount(
    promoCode: { discountType: PromoDiscountType; discountValue: number; maxDiscountAmount: bigint | null },
    amount: bigint,
  ): bigint {
    let discount =
      promoCode.discountType === PromoDiscountType.PERCENTAGE
        ? BigInt(Math.round((Number(amount) * promoCode.discountValue) / 100))
        : BigInt(Math.round(promoCode.discountValue));
    if (promoCode.maxDiscountAmount !== null && discount > promoCode.maxDiscountAmount) {
      discount = promoCode.maxDiscountAmount;
    }
    if (discount > amount) discount = amount;
    return discount;
  }

  private async paginate(where: Prisma.PromoCodeWhereInput, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const [data, total] = await Promise.all([
      this.prisma.promoCode.findMany({ where, skip: query.skip, take: query.take, orderBy: { createdAt: 'desc' } }),
      this.prisma.promoCode.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }
}