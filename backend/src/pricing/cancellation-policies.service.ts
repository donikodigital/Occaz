// backend/src/pricing/cancellation-policies.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { toMoneyBigInt } from '../common/utils/money.util';
import { CreateCancellationPolicyDto } from './dto/create-cancellation-policy.dto';
import { UpdateCancellationPolicyDto } from './dto/update-cancellation-policy.dto';

/**
 * CRUD admin sur la table que PricingService.getCancellationPolicy lit
 * déjà depuis le Lot 3 (section 26/63) — Bookings et Shipments
 * consomment ces règles pour calculer le pourcentage remboursable à
 * l'annulation.
 */
@Injectable()
export class CancellationPoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(serviceType?: ServiceType) {
    return this.prisma.cancellationPolicy.findMany({
      where: { serviceType },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const policy = await this.prisma.cancellationPolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException("Politique d'annulation introuvable.");
    return policy;
  }

  async create(dto: CreateCancellationPolicyDto, actorId: string) {
    const policy = await this.prisma.cancellationPolicy.create({
      data: {
        serviceType: dto.serviceType,
        countryId: dto.countryId,
        hoursBeforeDeparture: dto.hoursBeforeDeparture,
        refundPercentage: dto.refundPercentage,
        cancellationFee: dto.cancellationFee ? toMoneyBigInt(dto.cancellationFee) : undefined,
        currencyId: dto.currencyId,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'CancellationPolicy',
      entityId: policy.id,
      action: 'CREATE',
      diff: { ...dto },
    });
    return policy;
  }

  async update(id: string, dto: UpdateCancellationPolicyDto, actorId: string) {
    await this.findOne(id);
    const policy = await this.prisma.cancellationPolicy.update({
      where: { id },
      data: {
        serviceType: dto.serviceType,
        countryId: dto.countryId,
        hoursBeforeDeparture: dto.hoursBeforeDeparture,
        refundPercentage: dto.refundPercentage,
        cancellationFee: dto.cancellationFee ? toMoneyBigInt(dto.cancellationFee) : undefined,
        currencyId: dto.currencyId,
        isActive: dto.isActive,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'CancellationPolicy',
      entityId: id,
      action: 'UPDATE',
      diff: { ...dto },
    });
    return policy;
  }

  async deactivate(id: string, actorId: string) {
    await this.findOne(id);
    const policy = await this.prisma.cancellationPolicy.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      actorId,
      entityType: 'CancellationPolicy',
      entityId: id,
      action: 'DEACTIVATE',
    });
    return policy;
  }
}
