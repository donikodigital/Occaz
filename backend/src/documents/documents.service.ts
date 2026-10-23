// backend/src/documents/documents.service.ts
//
// [23/10/2026] v2 — Suppression d'une pièce par son propriétaire (removeOwned) : suppression logique (deletedAt) + effacement du fichier
// dans le stockage, sauf s'il sert encore de justificatif à une vérification ou à un litige. Les lectures ignorent désormais les
// documents supprimés.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
      where: { ownerType, ownerId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const document = await this.prisma.document.findFirst({ where: { id, deletedAt: null } });
    if (!document) throw new NotFoundException('Document introuvable.');
    return document;
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { ownerType?: DocumentOwnerType; ownerId?: string; status?: DocumentStatus } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = { ownerType: filters.ownerType, ownerId: filters.ownerId, status: filters.status, deletedAt: null };
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
        deletedAt: null,
        expiresAt: { gte: now, lte: addDuration(`${withinDays}d`, now) },
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  /**
   * Suppression d'une pièce par son propriétaire (le module appelant a déjà vérifié que `ownerId` est bien celui de l'utilisateur).
   * Une pièce déjà VÉRIFIÉE ne se supprime pas : elle atteste du dossier ; pour la changer, on en renvoie une nouvelle.
   * Les autres envois non vérifiés du même type partent avec elle (sinon un ancien envoi rejeté réapparaîtrait à l'écran).
   * Le fichier est effacé du stockage, sauf s'il sert encore de justificatif (vérification, litige).
   */
  async removeOwned(ownerType: DocumentOwnerType, ownerId: string, documentId: string, actorId: string): Promise<{ deleted: number }> {
    const document = await this.prisma.document.findFirst({ where: { id: documentId, ownerType, ownerId, deletedAt: null } });
    if (!document) throw new NotFoundException('Document introuvable.');
    if (document.status === DocumentStatus.VERIFIED) {
      throw new ConflictException(
        'Ce document a déjà été vérifié : il ne peut pas être supprimé. Pour le changer, envoyez-en un nouveau.',
      );
    }

    const toDelete = await this.prisma.document.findMany({
      where: { ownerType, ownerId, type: document.type, deletedAt: null, status: { not: DocumentStatus.VERIFIED } },
      select: { id: true, storageKey: true },
    });
    const ids = toDelete.map((row) => row.id);
    await this.prisma.document.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });

    for (const row of toDelete) {
      const [verifications, evidence] = await Promise.all([
        this.prisma.verification.count({ where: { documentId: row.id } }),
        this.prisma.disputeEvidence.count({ where: { documentId: row.id } }),
      ]);
      if (verifications === 0 && evidence === 0) await this.storageService.deleteObject(row.storageKey);
    }

    await this.audit.log({
      actorId,
      entityType: 'Document',
      entityId: documentId,
      action: 'DELETE',
      diff: { type: document.type, ownerType, removedUploads: ids.length },
    });
    return { deleted: ids.length };
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
