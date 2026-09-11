// backend/src/geography/currencies.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';

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
    await this.audit.log({
      actorId,
      entityType: 'Currency',
      entityId: currency.id,
      action: 'CREATE',
      diff: { ...dto },
    });
    return currency;
  }
}
