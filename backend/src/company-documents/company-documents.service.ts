// backend/src/company-documents/company-documents.service.ts
// [25/10/2026] v1 — Documents de l'entreprise : procès-verbaux de réunion, statuts, contrats… stockés dans le stockage d'objets (R2/S3).
//
// Envoi en deux temps, comme les pièces des conducteurs : (1) le serveur donne un lien d'envoi signé et une clé fabriquée POUR CE COMPTE ; le
// navigateur envoie le fichier directement au stockage (il ne transite jamais par ce serveur) ; (2) le navigateur « confirme » avec la clé : le
// serveur contrôle alors la clé, vérifie dans le stockage que le fichier est arrivé et qu'il respecte la taille permise, puis crée la fiche.
// Un envoi jamais confirmé ne laisse donc aucune trace en base.
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { assertStorageKeyOwnedBy } from '../storage/storage-key.util';
import type { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import {
  COMPANY_DOCUMENT_CATEGORIES,
  COMPANY_DOCUMENT_FOLDER,
  DOCUMENT_CONTENT_TYPES,
  DOCUMENT_EXTENSIONS,
  MAX_DOCUMENT_BYTES,
  canChangeCompanyDocument,
  canSeeCompanyDocument,
  cleanFileName,
  contentDispositionFor,
  opensInBrowser,
  parseDocumentDate,
  visibleDocumentsWhere,
  type CompanyDocumentCategoryKey,
} from './company-document-rules';
import type {
  CreateCompanyDocumentDto,
  DocumentLinkQueryDto,
  ListCompanyDocumentsQueryDto,
  RequestDocumentUploadDto,
  UpdateCompanyDocumentDto,
} from './dto/company-document.dto';

const WITH_UPLOADER = {
  uploadedBy: { select: { id: true, email: true, phone: true, staffProfile: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.CompanyDocumentInclude;

type DocumentRow = Prisma.CompanyDocumentGetPayload<{ include: typeof WITH_UPLOADER }>;

export interface CompanyDocumentView {
  id: string;
  title: string;
  category: CompanyDocumentCategoryKey;
  description: string | null;
  /** « 2026-10-12 » ou null. */
  documentDate: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  restricted: boolean;
  uploadedById: string | null;
  uploadedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Peut le modifier ou le supprimer (SuperAdmin ou la personne qui l'a déposé). */
  canChange: boolean;
  opensInBrowser: boolean;
}

export interface CompanyDocumentStats {
  total: number;
  totalBytes: number;
  byCategory: Record<CompanyDocumentCategoryKey, number>;
}

function uploaderName(row: DocumentRow): string | null {
  const user = row.uploadedBy;
  if (!user) return null;
  const staff = user.staffProfile ? `${user.staffProfile.firstName} ${user.staffProfile.lastName}`.replace(/\s+/g, ' ').trim() : '';
  return staff || user.email || user.phone;
}

function present(row: DocumentRow, viewer: AuthenticatedUser): CompanyDocumentView {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    documentDate: row.documentDate ? row.documentDate.toISOString().slice(0, 10) : null,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    restricted: row.restricted,
    uploadedById: row.uploadedById,
    uploadedByName: uploaderName(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    canChange: canChangeCompanyDocument(viewer, row),
    opensInBrowser: opensInBrowser(row.contentType),
  };
}

const clean = (value: string | undefined): string | undefined => (value === undefined ? undefined : value.replace(/\s+/g, ' ').trim());

@Injectable()
export class CompanyDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListCompanyDocumentsQueryDto, viewer: AuthenticatedUser): Promise<PaginatedResult<CompanyDocumentView>> {
    const search = query.search?.trim();
    const where: Prisma.CompanyDocumentWhereInput = {
      AND: [
        visibleDocumentsWhere(viewer),
        query.category ? { category: query.category } : {},
        search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { fileName: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.companyDocument.findMany({
        where,
        include: WITH_UPLOADER,
        orderBy: [{ documentDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: query.skip,
        take: query.take,
      }),
      this.prisma.companyDocument.count({ where }),
    ]);
    return new PaginatedResult(rows.map((row) => present(row, viewer)), total, query.page, query.limit);
  }

  /** Nombre de documents par catégorie et espace utilisé — uniquement ce que le compte a le droit de voir. */
  async stats(viewer: AuthenticatedUser): Promise<CompanyDocumentStats> {
    const where = visibleDocumentsWhere(viewer);
    const groups = await this.prisma.companyDocument.groupBy({ by: ['category'], where, _count: { _all: true }, _sum: { sizeBytes: true } });
    const byCategory = Object.fromEntries(COMPANY_DOCUMENT_CATEGORIES.map((key) => [key, 0])) as Record<CompanyDocumentCategoryKey, number>;
    let total = 0;
    let totalBytes = 0;
    for (const group of groups) {
      byCategory[group.category] = group._count._all;
      total += group._count._all;
      totalBytes += group._sum.sizeBytes ?? 0;
    }
    return { total, totalBytes, byCategory };
  }

  /** Étape 1 : une clé fabriquée pour ce compte et un lien d'envoi signé (quelques minutes). */
  async requestUpload(dto: RequestDocumentUploadDto, user: AuthenticatedUser) {
    const extension = DOCUMENT_CONTENT_TYPES[dto.contentType];
    const storageKey = this.storage.buildKey(COMPANY_DOCUMENT_FOLDER, user.id, extension);
    const { uploadUrl, expiresInSeconds } = await this.storage.createUploadUrl(storageKey, dto.contentType);
    return { uploadUrl, storageKey, expiresInSeconds, maxBytes: MAX_DOCUMENT_BYTES };
  }

  /** Étape 2 : le fichier est envoyé, on crée la fiche. */
  async create(dto: CreateCompanyDocumentDto, user: AuthenticatedUser): Promise<CompanyDocumentView> {
    const storageKey = assertStorageKeyOwnedBy(
      dto.storageKey,
      [{ folder: COMPANY_DOCUMENT_FOLDER, ownerId: user.id }],
      "Fichier invalide : renvoie-le depuis la page Documents.",
      DOCUMENT_EXTENSIONS,
    );
    // L'extension de la clé doit correspondre au type annoncé : on n'enregistre pas un « .pdf » déclaré comme un Excel.
    if (!storageKey.endsWith(`.${DOCUMENT_CONTENT_TYPES[dto.contentType]}`)) {
      throw new BadRequestException('Le type du fichier ne correspond pas à celui de l’envoi : renvoie le fichier.');
    }

    const title = clean(dto.title);
    if (!title) throw new BadRequestException('Donne un titre au document.');
    const documentDate = parseDocumentDate(dto.documentDate);
    if (documentDate === undefined) throw new BadRequestException('La date du document n’est pas valide.');

    // Le fichier est-il vraiment arrivé, et à la bonne taille ? (le client pourrait avoir menti sur la taille annoncée)
    const stored = await this.storage.headObject(storageKey);
    if (!stored) throw new BadRequestException("Le fichier n'est pas arrivé dans le stockage : renvoie-le.");
    if (stored.size <= 0 || stored.size > MAX_DOCUMENT_BYTES) {
      await this.storage.deleteObject(storageKey);
      throw new BadRequestException(stored.size <= 0 ? 'Le fichier est vide.' : 'Le fichier dépasse 25 Mo.');
    }
    if (stored.contentType && stored.contentType !== dto.contentType) {
      await this.storage.deleteObject(storageKey);
      throw new BadRequestException('Le type du fichier envoyé ne correspond pas à celui annoncé : renvoie le fichier.');
    }

    let row: DocumentRow;
    try {
      row = await this.prisma.companyDocument.create({
        data: {
          title,
          category: dto.category,
          description: clean(dto.description) || null,
          documentDate,
          fileName: cleanFileName(dto.fileName),
          contentType: dto.contentType,
          sizeBytes: stored.size,
          storageKey,
          restricted: dto.restricted ?? false,
          uploadedById: user.id,
        },
        include: WITH_UPLOADER,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ce fichier est déjà enregistré.');
      }
      throw error;
    }
    await this.audit.log({
      actorId: user.id,
      entityType: 'CompanyDocument',
      entityId: row.id,
      action: 'CREATED',
      diff: { title: row.title, category: row.category, fileName: row.fileName, sizeBytes: row.sizeBytes, restricted: row.restricted },
    });
    return present(row, user);
  }

  /** Un document invisible pour ce compte « n'existe pas » : on ne révèle pas qu'un document réservé existe. */
  private async loadVisible(id: string, user: AuthenticatedUser): Promise<DocumentRow> {
    const row = await this.prisma.companyDocument.findUnique({ where: { id }, include: WITH_UPLOADER });
    if (!row || !canSeeCompanyDocument(user, row)) throw new NotFoundException('Document introuvable.');
    return row;
  }

  private assertCanChange(row: DocumentRow, user: AuthenticatedUser): void {
    if (!canChangeCompanyDocument(user, row)) {
      throw new ForbiddenException('Seul le SuperAdmin ou la personne qui a déposé ce document peut le modifier ou le supprimer.');
    }
  }

  async update(id: string, dto: UpdateCompanyDocumentDto, user: AuthenticatedUser): Promise<CompanyDocumentView> {
    const row = await this.loadVisible(id, user);
    this.assertCanChange(row, user);

    const data: Prisma.CompanyDocumentUpdateInput = {};
    const changed: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      const title = clean(dto.title);
      if (!title) throw new BadRequestException('Le titre ne peut pas être vide.');
      if (title !== row.title) {
        data.title = title;
        changed.title = title;
      }
    }
    if (dto.category !== undefined && dto.category !== row.category) {
      data.category = dto.category;
      changed.category = dto.category;
    }
    if (dto.documentDate !== undefined) {
      const parsed = parseDocumentDate(dto.documentDate);
      if (parsed === undefined) throw new BadRequestException('La date du document n’est pas valide.');
      const before = row.documentDate ? row.documentDate.toISOString().slice(0, 10) : null;
      const after = parsed ? parsed.toISOString().slice(0, 10) : null;
      if (before !== after) {
        data.documentDate = parsed;
        changed.documentDate = after;
      }
    }
    if (dto.description !== undefined) {
      const description = clean(dto.description) || null;
      if (description !== row.description) {
        data.description = description;
        changed.description = description === null ? null : 'modifiée';
      }
    }
    if (dto.restricted !== undefined && dto.restricted !== row.restricted) {
      data.restricted = dto.restricted;
      changed.restricted = dto.restricted;
    }
    if (Object.keys(data).length === 0) return present(row, user);

    const updated = await this.prisma.companyDocument.update({ where: { id }, data, include: WITH_UPLOADER });
    await this.audit.log({ actorId: user.id, entityType: 'CompanyDocument', entityId: id, action: 'UPDATED', diff: changed as Prisma.InputJsonValue });
    return present(updated, user);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<{ deleted: true }> {
    const row = await this.loadVisible(id, user);
    this.assertCanChange(row, user);
    await this.prisma.companyDocument.delete({ where: { id } });
    // Le fichier part après la fiche : en cas d'échec du stockage, il reste un objet orphelin (sans fiche, donc inaccessible), jamais l'inverse.
    await this.storage.deleteObject(row.storageKey);
    await this.audit.log({ actorId: user.id, entityType: 'CompanyDocument', entityId: id, action: 'DELETED', diff: { title: row.title, fileName: row.fileName } });
    return { deleted: true };
  }

  /** Lien de lecture signé (5 minutes) : ouvrir dans le navigateur (PDF, images) ou enregistrer. Chaque accès est journalisé. */
  async link(id: string, query: DocumentLinkQueryDto, user: AuthenticatedUser) {
    const row = await this.loadVisible(id, user);
    const inline = query.mode !== 'download' && opensInBrowser(row.contentType);
    const url = await this.storage.createDownloadUrl(row.storageKey, { contentDisposition: contentDispositionFor(row.fileName, inline) });
    await this.audit.log({
      actorId: user.id,
      entityType: 'CompanyDocument',
      entityId: id,
      action: inline ? 'OPENED' : 'DOWNLOADED',
      diff: { title: row.title, restricted: row.restricted },
    });
    return { url, fileName: row.fileName, mode: inline ? ('open' as const) : ('download' as const), expiresInSeconds: 300 };
  }
}
