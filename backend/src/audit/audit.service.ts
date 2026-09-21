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
  diff?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/**
 * Seuls ces champs de l'acteur sont renvoyés avec une entrée du journal.
 * `include: { actor: true }` renvoyait la ligne User complète — donc
 * passwordHash et twoFactorSecret — à toute personne ayant AUDIT_READ.
 * Même principe que UsersService.toSafeUser : ces deux champs ne quittent
 * jamais le backend.
 */
const ACTOR_SELECT = { id: true, email: true, phone: true } as const;

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

  async log(input: AuditLogInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        diff: input.diff,
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
        include: { actor: { select: ACTOR_SELECT } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }
}