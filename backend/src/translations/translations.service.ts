// backend/src/translations/translations.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { UpsertTranslationDto } from './dto/upsert-translation.dto';

@Injectable()
export class TranslationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Utilisable par n'importe quel module pour restituer un champ traduit (repli sur la langue source si absent). */
  findForEntity(entityType: string, entityId: string, locale?: string) {
    return this.prisma.translation.findMany({
      where: { entityType, entityId, locale },
    });
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { entityType?: string; locale?: string } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = { entityType: filters.entityType, locale: filters.locale };
    const [data, total] = await Promise.all([
      this.prisma.translation.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: [{ entityType: 'asc' }, { entityId: 'asc' }, { locale: 'asc' }],
      }),
      this.prisma.translation.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async upsert(dto: UpsertTranslationDto, actorId: string) {
    const translation = await this.prisma.translation.upsert({
      where: {
        entityType_entityId_locale_field: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          locale: dto.locale,
          field: dto.field,
        },
      },
      update: { value: dto.value },
      create: { ...dto },
    });
    await this.audit.log({
      actorId,
      entityType: 'Translation',
      entityId: translation.id,
      action: 'UPSERT',
      diff: { ...dto },
    });
    return translation;
  }

  async remove(entityType: string, entityId: string, locale: string, field: string, actorId: string) {
    const translation = await this.prisma.translation.findUnique({
      where: { entityType_entityId_locale_field: { entityType, entityId, locale, field } },
    });
    if (!translation) throw new NotFoundException('Traduction introuvable.');

    await this.prisma.translation.delete({ where: { id: translation.id } });
    await this.audit.log({
      actorId,
      entityType: 'Translation',
      entityId: translation.id,
      action: 'DELETE',
      diff: { entityType, entityId, locale, field },
    });
  }
}
