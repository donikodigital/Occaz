// backend/src/shipment-categories/shipment-categories.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toMoneyBigInt } from '../common/utils/money.util';
import { CreateShipmentCategoryDto } from './dto/create-shipment-category.dto';
import { UpdateShipmentCategoryDto } from './dto/update-shipment-category.dto';

/**
 * Règles des envois (section 61) : chaque catégorie porte son propre
 * indicateur "autorisé/non autorisé" et sa portée pays, configurables
 * sans redéploiement — décision Partie VII 7.2 (ex ShipmentCategory).
 */
@Injectable()
export class ShipmentCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Catégories utilisables pour un pays donné : règles globales + spécifiques à ce pays. */
  findAllUsable(countryId?: string) {
    return this.prisma.shipmentCategory.findMany({
      where: {
        isAllowed: true,
        ...(countryId ? { OR: [{ countryId }, { countryId: null }] } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  findAll() {
    return this.prisma.shipmentCategory.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const category = await this.prisma.shipmentCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Catégorie d\'envoi introuvable.');
    return category;
  }

  async create(dto: CreateShipmentCategoryDto, actorId: string) {
    const category = await this.prisma.shipmentCategory.create({
      data: {
        name: dto.name,
        description: dto.description,
        isAllowed: dto.isAllowed ?? true,
        countryId: dto.countryId,
        maxDeclaredValue: dto.maxDeclaredValue ? toMoneyBigInt(dto.maxDeclaredValue) : undefined,
        currencyId: dto.currencyId,
        priceMultiplier: dto.priceMultiplier ?? 1.0,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'ShipmentCategory',
      entityId: category.id,
      action: 'CREATE',
      diff: { ...dto },
    });
    return category;
  }

  async update(id: string, dto: UpdateShipmentCategoryDto, actorId: string) {
    await this.findOne(id);
    const category = await this.prisma.shipmentCategory.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isAllowed: dto.isAllowed,
        countryId: dto.countryId,
        maxDeclaredValue: dto.maxDeclaredValue ? toMoneyBigInt(dto.maxDeclaredValue) : undefined,
        currencyId: dto.currencyId,
        priceMultiplier: dto.priceMultiplier,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'ShipmentCategory',
      entityId: id,
      action: 'UPDATE',
      diff: { ...dto },
    });
    return category;
  }
}
