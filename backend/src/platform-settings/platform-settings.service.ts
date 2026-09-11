// backend/src/platform-settings/platform-settings.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UpsertPlatformSettingDto } from './dto/upsert-platform-setting.dto';

/**
 * Interface d'administration de la table clé/valeur déjà lue en
 * interne depuis le Lot 3 (TripsService.getSearchRadiusKm) et le Lot 4
 * (PricingService.getNumericSetting/computeShipmentPrice) — ce service
 * n'ajoute aucune nouvelle logique de lecture, seulement la gestion.
 */
@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * `value` est saisi en `unknown` côté DTO (n'importe quelle valeur JSON
   * valide). On le sérialise en JSON avant de l'envoyer à Prisma plutôt que
   * de faire un cast `as never`, pour garantir un vrai objet JSON-safe.
   */
  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  findAll() {
    return this.prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async findOne(key: string) {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Paramètre "${key}" introuvable.`);
    return setting;
  }

  async upsert(dto: UpsertPlatformSettingDto, actorId: string) {
    const jsonValue = this.toJsonValue(dto.value);
    const setting = await this.prisma.platformSetting.upsert({
      where: { key: dto.key },
      update: { value: jsonValue, description: dto.description, updatedById: actorId },
      create: {
        key: dto.key,
        value: jsonValue,
        description: dto.description,
        updatedById: actorId,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'PlatformSetting',
      entityId: setting.id,
      action: 'UPSERT',
      diff: { key: dto.key, value: dto.value },
    });
    return setting;
  }

  async remove(key: string, actorId: string) {
    const setting = await this.findOne(key);
    await this.prisma.platformSetting.delete({ where: { key } });
    await this.audit.log({
      actorId,
      entityType: 'PlatformSetting',
      entityId: setting.id,
      action: 'DELETE',
      diff: { key },
    });
  }
}