// backend/src/pricing/commission-rules.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toMoneyBigInt } from '../common/utils/money.util';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { UpdateCommissionRuleDto } from './dto/update-commission-rule.dto';

/**
 * CRUD admin sur la table que PricingService.computeCommission lit déjà
 * depuis le Lot 3 (section 39) — ce service ne fait que rendre ces
 * règles gérables depuis le back-office, sans changer la logique de
 * calcul elle-même.
 */
@Injectable()
export class CommissionRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(serviceType?: ServiceType) {
    return this.prisma.commissionRule.findMany({
      where: { serviceType },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.commissionRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Règle de commission introuvable.');
    return rule;
  }

  private assertExclusive(dto: CreateCommissionRuleDto | UpdateCommissionRuleDto) {
    if (dto.percentage !== undefined && dto.fixedAmount !== undefined) {
      throw new BadRequestException('percentage et fixedAmount sont exclusifs — fournissez un seul des deux.');
    }
  }

  async create(dto: CreateCommissionRuleDto, actorId: string) {
    this.assertExclusive(dto);
    const rule = await this.prisma.commissionRule.create({
      data: {
        serviceType: dto.serviceType,
        countryId: dto.countryId,
        percentage: dto.percentage,
        fixedAmount: dto.fixedAmount ? toMoneyBigInt(dto.fixedAmount) : undefined,
        minAmount: dto.minAmount ? toMoneyBigInt(dto.minAmount) : undefined,
        maxAmount: dto.maxAmount ? toMoneyBigInt(dto.maxAmount) : undefined,
        currencyId: dto.currencyId,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'CommissionRule',
      entityId: rule.id,
      action: 'CREATE',
      diff: { ...dto },
    });
    return rule;
  }

  async update(id: string, dto: UpdateCommissionRuleDto, actorId: string) {
    await this.findOne(id);
    this.assertExclusive(dto);
    const rule = await this.prisma.commissionRule.update({
      where: { id },
      data: {
        serviceType: dto.serviceType,
        countryId: dto.countryId,
        percentage: dto.percentage,
        fixedAmount: dto.fixedAmount ? toMoneyBigInt(dto.fixedAmount) : undefined,
        minAmount: dto.minAmount ? toMoneyBigInt(dto.minAmount) : undefined,
        maxAmount: dto.maxAmount ? toMoneyBigInt(dto.maxAmount) : undefined,
        currencyId: dto.currencyId,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'CommissionRule',
      entityId: id,
      action: 'UPDATE',
      diff: { ...dto },
    });
    return rule;
  }

  async deactivate(id: string, actorId: string) {
    await this.findOne(id);
    const rule = await this.prisma.commissionRule.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({ actorId, entityType: 'CommissionRule', entityId: id, action: 'DEACTIVATE' });
    return rule;
  }
}
