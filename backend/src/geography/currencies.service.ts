// backend/src/geography/currencies.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Injectable()
export class CurrenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.currency.findMany({ orderBy: { isoCode: 'asc' } });
  }

  async findOne(id: string) {
    const currency = await this.prisma.currency.findUnique({ where: { id } });
    if (!currency) throw new NotFoundException('Devise introuvable.');
    return currency;
  }

  async create(dto: CreateCurrencyDto, actorId: string) {
    const currency = await this.prisma.currency.create({
      data: {
        isoCode: dto.isoCode.toUpperCase(),
        name: dto.name,
        symbol: dto.symbol,
        decimalDigits: dto.decimalDigits ?? 0,
      },
    });
    await this.audit.log({ actorId, entityType: 'Currency', entityId: currency.id, action: 'CREATE', diff: { ...dto } });
    return currency;
  }

  async update(id: string, dto: UpdateCurrencyDto, actorId: string) {
    await this.findOne(id);
    const currency = await this.prisma.currency.update({
      where: { id },
      data: { ...dto, isoCode: dto.isoCode ? dto.isoCode.toUpperCase() : undefined },
    });
    await this.audit.log({ actorId, entityType: 'Currency', entityId: id, action: 'UPDATE', diff: { ...dto } });
    return currency;
  }

  /** Bloqué si un pays utilise encore cette devise par défaut. */
  async remove(id: string, actorId: string) {
    await this.findOne(id);
    const usedByCountry = await this.prisma.country.findFirst({ where: { defaultCurrencyId: id } });
    if (usedByCountry) {
      throw new ConflictException(
        `Cette devise est utilisée par défaut par "${usedByCountry.name}" — change sa devise par défaut avant de la supprimer.`,
      );
    }
    await this.prisma.currency.delete({ where: { id } });
    await this.audit.log({ actorId, entityType: 'Currency', entityId: id, action: 'DELETE' });
  }
}