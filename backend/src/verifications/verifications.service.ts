// backend/src/verifications/verifications.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { VerificationStatus, VerificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { CreateVerificationDto } from './dto/create-verification.dto';

/**
 * Suivi du processus de vérification (section 5 : pièce d'identité,
 * permis, carte grise) — distinct du statut simple porté par Document
 * (PENDING/VERIFIED/REJECTED, Lot 2) : Verification trace l'événement de
 * revue lui-même (qui, quand, pourquoi), utile pour l'historique et le
 * support. Approuver toutes les vérifications requises ne bascule pas
 * automatiquement DriverProfile.status — cette décision finale reste un
 * geste explicite du support (DriverProfilesService.verify, Lot 2), pour
 * ne pas figer ici une liste de vérifications "obligatoires" que le
 * cahier des charges ne définit pas précisément.
 */
@Injectable()
export class VerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findOne(id: string) {
    const verification = await this.prisma.verification.findUnique({
      where: { id },
      include: { document: true },
    });
    if (!verification) throw new NotFoundException('Vérification introuvable.');
    return verification;
  }

  findAllForUser(userId: string) {
    return this.prisma.verification.findMany({
      where: { userId },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async request(userId: string, driverId: string | undefined, dto: CreateVerificationDto) {
    return this.prisma.verification.create({
      data: {
        userId,
        driverId,
        type: dto.type,
        documentId: dto.documentId,
        status: VerificationStatus.PENDING,
      },
    });
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: VerificationStatus; type?: VerificationType } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = { status: filters.status, type: filters.type };
    const [data, total] = await Promise.all([
      this.prisma.verification.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { document: true },
      }),
      this.prisma.verification.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async approve(id: string, actorId: string) {
    await this.findOne(id);
    const verification = await this.prisma.verification.update({
      where: { id },
      data: { status: VerificationStatus.APPROVED, reviewedById: actorId, reviewedAt: new Date() },
    });
    await this.audit.log({
      actorId,
      entityType: 'Verification',
      entityId: id,
      action: 'APPROVE',
    });
    return verification;
  }

  async reject(id: string, reason: string, actorId: string) {
    await this.findOne(id);
    const verification = await this.prisma.verification.update({
      where: { id },
      data: {
        status: VerificationStatus.REJECTED,
        reviewedById: actorId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    });
    await this.audit.log({
      actorId,
      entityType: 'Verification',
      entityId: id,
      action: 'REJECT',
      diff: { reason },
    });
    return verification;
  }
}
