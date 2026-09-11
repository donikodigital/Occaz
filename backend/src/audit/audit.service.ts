// backend/src/audit/audit.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';

export interface AuditLogInput {
  actorId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  /**
   * Accepte n'importe quel objet "plat" issu d'un DTO (Record<string, unknown>).
   * Sérialisé via JSON avant écriture pour garantir la compatibilité avec
   * Prisma.InputJsonValue (élimine les `undefined` imbriqués, fonctions, etc.
   * qui ne sont pas assignables à un type JSON strict).
   */
  diff?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * Point d'entrée unique pour journaliser une action administrative
 * sensible (section 49 du cahier des charges). Même le SuperAdmin doit
 * laisser une trace — c'est pourquoi ce service ne fait aucune
 * distinction de rôle : tout appelant qui modifie une ressource sensible
 * doit passer par ici.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  private toJsonValue(diff: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | undefined {
    if (diff === undefined || diff === null) return undefined;
    // JSON.stringify/parse élimine tout ce qui n'est pas sérialisable en JSON
    // (undefined, fonctions, symboles...) et retourne un objet dont le type
    // est compatible avec Prisma.InputJsonValue sans cast dangereux côté appelant.
    return JSON.parse(JSON.stringify(diff)) as Prisma.InputJsonValue;
  }

  async log(input: AuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        diff: this.toJsonValue(input.diff),
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { entityType?: string; entityId?: string; actorId?: string } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = {
      entityType: filters.entityType,
      entityId: filters.entityId,
      actorId: filters.actorId,
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { actor: true },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }
}