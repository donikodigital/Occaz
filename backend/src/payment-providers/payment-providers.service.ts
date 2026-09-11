// backend/src/payment-providers/payment-providers.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProviderType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentProviderDto } from './dto/create-payment-provider.dto';
import { UpdatePaymentProviderDto } from './dto/update-payment-provider.dto';

/**
 * Implémente l'architecture d'intégration abstraite du cahier des
 * charges (section 14) : PaymentService -> OrangeMoneyProvider /
 * MobileMoneyProvider / XOFProvider / FutureProvider. Chaque ligne de
 * cette table EST l'un de ces providers, configuré sans redéploiement.
 */
@Injectable()
export class PaymentProvidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * `config` est saisi côté DTO en `Record<string, unknown>` (validation
   * class-validator @IsObject). On le sérialise en JSON avant de l'envoyer
   * à Prisma pour garantir la compatibilité avec `Prisma.InputJsonValue`
   * (élimine les `undefined` imbriqués et types non JSON-sérialisables).
   */
  private toJsonValue(config: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
    if (config === undefined) return undefined;
    return JSON.parse(JSON.stringify(config)) as Prisma.InputJsonValue;
  }

  findAllActiveForCountry(countryId?: string, type?: PaymentProviderType) {
    return this.prisma.paymentProvider.findMany({
      where: {
        isActive: true,
        type,
        ...(countryId ? { OR: [{ countryId }, { countryId: null }] } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  findAll() {
    return this.prisma.paymentProvider.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const provider = await this.prisma.paymentProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Moyen de paiement introuvable.');
    return provider;
  }

  async create(dto: CreatePaymentProviderDto, actorId: string) {
    const provider = await this.prisma.paymentProvider.create({
      data: {
        type: dto.type,
        name: dto.name,
        countryId: dto.countryId,
        config: this.toJsonValue(dto.config),
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'PaymentProvider',
      entityId: provider.id,
      action: 'CREATE',
      diff: { ...dto },
    });
    return provider;
  }

  async update(id: string, dto: UpdatePaymentProviderDto, actorId: string) {
    await this.findOne(id);
    const provider = await this.prisma.paymentProvider.update({
      where: { id },
      data: {
        type: dto.type,
        name: dto.name,
        countryId: dto.countryId,
        config: this.toJsonValue(dto.config),
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'PaymentProvider',
      entityId: id,
      action: 'UPDATE',
      diff: { ...dto },
    });
    return provider;
  }

  async deactivate(id: string, actorId: string) {
    await this.findOne(id);
    const provider = await this.prisma.paymentProvider.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      actorId,
      entityType: 'PaymentProvider',
      entityId: id,
      action: 'DEACTIVATE',
    });
    return provider;
  }

  async activate(id: string, actorId: string) {
    await this.findOne(id);
    const provider = await this.prisma.paymentProvider.update({
      where: { id },
      data: { isActive: true },
    });
    await this.audit.log({
      actorId,
      entityType: 'PaymentProvider',
      entityId: id,
      action: 'ACTIVATE',
    });
    return provider;
  }
}