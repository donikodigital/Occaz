// backend/src/documents/documents.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentOwnerType, DocumentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { CreateDocumentDto } from './dto/create-document.dto';
import { addDuration } from '../common/utils/duration.util';

/**
 * Service générique (section 43 : un seul modèle Document polymorphique).
 * Ne contient AUCUNE logique d'autorisation propre à un type de
 * propriétaire — c'est aux modules appelants (DriverProfiles, Vehicles...)
 * de vérifier que l'utilisateur courant a le droit d'attacher un document
 * à `ownerId` avant d'appeler `create`.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storageService: StorageService,
  ) {}

  /** URL temporaire pour visualiser une pièce depuis le back-office — jamais d'accès direct au storageKey brut. */
  async createDownloadUrl(id: string): Promise<{ url: string; expiresInSeconds: number }> {
    const document = await this.findOne(id);
    const url = await this.storageService.createDownloadUrl(document.storageKey);
    return { url, expiresInSeconds: 300 };
  }

  create(ownerType: DocumentOwnerType, ownerId: string, dto: CreateDocumentDto) {
    return this.prisma.document.create({
      data: {
        ownerType,
        ownerId,
        type: dto.type,
        storageKey: dto.storageKey,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        status: DocumentStatus.PENDING,
      },
    });
  }

  findAllForOwner(ownerType: DocumentOwnerType, ownerId: string) {
    return this.prisma.document.findMany({
      where: { ownerType, ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) throw new NotFoundException('Document introuvable.');
    return document;
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { ownerType?: DocumentOwnerType; ownerId?: string; status?: DocumentStatus } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = { ownerType: filters.ownerType, ownerId: filters.ownerId, status: filters.status };
    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /**
   * Documents expirant bientôt — alimente la relance automatique
   * ("Votre permis expire dans 30 jours", section 44). Le déclenchement
   * effectif de la notification arrive au Lot 8 ; ce service expose déjà
   * la requête pour qu'un job planifié puisse s'y brancher directement.
   */
  findExpiringSoon(withinDays: number) {
    const now = new Date();
    return this.prisma.document.findMany({
      where: {
        status: DocumentStatus.VERIFIED,
        expiresAt: { gte: now, lte: addDuration(`${withinDays}d`, now) },
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  async verify(id: string, actorId: string) {
    await this.findOne(id);
    const document = await this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.VERIFIED, verifiedAt: new Date(), verifiedById: actorId },
    });
    await this.audit.log({
      actorId,
      entityType: 'Document',
      entityId: id,
      action: 'VERIFY',
    });
    return document;
  }

  async reject(id: string, reason: string, actorId: string) {
    await this.findOne(id);
    const document = await this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.REJECTED, rejectionReason: reason },
    });
    await this.audit.log({
      actorId,
      entityType: 'Document',
      entityId: id,
      action: 'REJECT',
      diff: { reason },
    });
    return document;
  }
}
