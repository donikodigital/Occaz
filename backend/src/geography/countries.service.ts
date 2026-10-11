// backend/src/geography/countries.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    if (dto.isSignupDefault) await this.setSignupDefault(country.id);
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
    const existing = await this.findOne(id);
    const { isSignupDefault, ...rest } = dto;
    if (isSignupDefault === true && !existing.isActive) {
      throw new BadRequestException('Un pays désactivé ne peut pas être le pays par défaut.');
    }
    let country = await this.prisma.country.update({
      where: { id },
      data: rest,
    });
    if (isSignupDefault === true) country = await this.setSignupDefault(id);
    if (isSignupDefault === false) country = await this.prisma.country.update({ where: { id }, data: { isSignupDefault: false } });
    await this.audit.log({
      actorId,
      entityType: 'Country',
      entityId: id,
      action: 'UPDATE',
      diff: { ...dto },
    });
    return country;
  }

  /** Un seul pays est présélectionné à l'inscription : en choisir un retire l'ancien. */
  private async setSignupDefault(id: string) {
    const [, country] = await this.prisma.$transaction([
      this.prisma.country.updateMany({ where: { isSignupDefault: true, id: { not: id } }, data: { isSignupDefault: false } }),
      this.prisma.country.update({ where: { id }, data: { isSignupDefault: true } }),
    ]);
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
      data: { isActive: false, isSignupDefault: false },
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
