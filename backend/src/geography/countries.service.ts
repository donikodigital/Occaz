// backend/src/geography/countries.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

@Injectable()
export class CountriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll(activeOnly = true) {
    return this.prisma.country.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const country = await this.prisma.country.findUnique({ where: { id } });
    if (!country) throw new NotFoundException('Pays introuvable.');
    return country;
  }

  async create(dto: CreateCountryDto, actorId: string) {
    const country = await this.prisma.country.create({
      data: {
        isoCode: dto.isoCode.toUpperCase(),
        name: dto.name,
        phoneCode: dto.phoneCode,
        defaultCurrencyId: dto.defaultCurrencyId,
        isCrossBorderEnabled: dto.isCrossBorderEnabled ?? false,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'Country',
      entityId: country.id,
      action: 'CREATE',
      diff: { ...dto },
    });
    return country;
  }

  async update(id: string, dto: UpdateCountryDto, actorId: string) {
    await this.findOne(id);
    const country = await this.prisma.country.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      actorId,
      entityType: 'Country',
      entityId: id,
      action: 'UPDATE',
      diff: { ...dto },
    });
    return country;
  }

  /**
   * Les pays ne sont jamais supprimés physiquement (trop de données
   * dépendantes) — seulement désactivés, ce qui les retire des listes
   * de recherche/inscription sans casser l'historique.
   */
  async deactivate(id: string, actorId: string) {
    await this.findOne(id);
    const country = await this.prisma.country.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      actorId,
      entityType: 'Country',
      entityId: id,
      action: 'DEACTIVATE',
    });
    return country;
  }
}
