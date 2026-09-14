// backend/src/profiles/driver-profiles/driver-profiles.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, DocumentOwnerType, DriverAccountStatus, NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { DocumentsService } from '../../documents/documents.service';
import { CreateDocumentDto } from '../../documents/dto/create-document.dto';
import { StorageService } from '../../storage/storage.service';
import { RequestUploadUrlDto, extensionForContentType } from '../../storage/dto/request-upload-url.dto';
import { ConfirmPhotoDto } from './dto/confirm-photo.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/dto/pagination-response.dto';
import { CreateDriverProfileDto } from './dto/create-driver-profile.dto';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';

@Injectable()
export class DriverProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly documentsService: DocumentsService,
    private readonly storageService: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async findByUserId(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { country: true, city: true, vehicles: true, wallet: true },
    });
    if (!profile) {
      throw new NotFoundException(
        "Aucun profil chauffeur — complétez d'abord votre inscription.",
      );
    }
    return profile;
  }

  async findOne(id: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { id },
      include: { country: true, city: true, vehicles: true, wallet: true },
    });
    if (!profile) throw new NotFoundException('Profil chauffeur introuvable.');
    return profile;
  }

  /**
   * Résout l'id DriverProfile à partir d'un userId — utilisé par les
   * modules Vehicle/Document pour vérifier qu'un utilisateur agit bien en
   * tant que propriétaire de la ressource qu'il manipule.
   */
  async getProfileIdForUser(userId: string): Promise<string> {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Aucun profil chauffeur pour cet utilisateur.');
    }
    return profile.id;
  }

  /**
   * Crée le profil ET son portefeuille associé dans la même transaction —
   * un chauffeur ne doit jamais exister sans Wallet (contrainte @unique
   * sur Wallet.driverId). La gestion complète du portefeuille (soldes,
   * retraits) arrive au Lot 5 ; ici on ne fait que garantir son existence
   * dès la création du profil, avec la devise par défaut du pays.
   */
  async createForUser(
    userId: string,
    accountType: AccountType,
    dto: CreateDriverProfileDto,
  ) {
    if (accountType !== AccountType.DRIVER) {
      throw new ConflictException(
        "Seul un compte de type DRIVER peut créer un profil chauffeur.",
      );
    }
    const existing = await this.prisma.driverProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Un profil chauffeur existe déjà pour ce compte.');
    }

    const country = await this.prisma.country.findUnique({ where: { id: dto.countryId } });
    if (!country) throw new NotFoundException('Pays introuvable.');
    if (!country.defaultCurrencyId) {
      throw new BadRequestException(
        `Le pays "${country.name}" n'a pas de devise par défaut configurée — impossible de créer le portefeuille du chauffeur. Contactez un administrateur.`,
      );
    }

    const profile = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (dto.email) {
        try {
          await tx.user.update({ where: { id: userId }, data: { email: dto.email } });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ConflictException('Cette adresse email est déjà utilisée par un autre compte.');
          }
          throw error;
        }
      }

      const created = await tx.driverProfile.create({
        data: {
          userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          photoUrl: dto.photoUrl,
          countryId: dto.countryId,
          cityId: dto.cityId,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          mobileMoneyNumber: dto.mobileMoneyNumber,
          status: DriverAccountStatus.PENDING,
        },
      });

      await tx.wallet.create({
        data: {
          driverId: created.id,
          currencyId: country.defaultCurrencyId!,
          balance: 0n,
          pendingBalance: 0n,
        },
      });

      return created;
    });

    // En dehors de la transaction : un envoi externe (push/email) ne doit
    // jamais faire échouer ni retarder l'écriture en base, et un envoi
    // manqué ici n'a pas besoin d'annuler la création du profil.
    await this.notifications.notify({
      userId,
      type: NotificationType.STATUS_CHANGE,
      channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      fallbackTitle: 'Bienvenue chez Transport Partagé',
      fallbackBody: `Bienvenue ${dto.firstName} ! Votre profil chauffeur est en cours de vérification.`,
    });

    return profile;
  }

  async updateForUser(userId: string, dto: UpdateDriverProfileDto) {
    const profile = await this.findByUserId(userId);
    return this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: DriverAccountStatus; countryId?: string } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = {
      status: filters.status,
      countryId: filters.countryId,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' as const } },
              { lastName: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.driverProfile.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { country: true, city: true },
      }),
      this.prisma.driverProfile.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** Validation d'un chauffeur — attribue le badge "Conducteur vérifié" (section 25). */
  async verify(id: string, actorId: string) {
    const existing = await this.findOne(id);
    if (!existing.photoUrl) {
      throw new BadRequestException(
        'Ce chauffeur doit avoir une photo de profil avant de pouvoir être validé.',
      );
    }
    const profile = await this.prisma.driverProfile.update({
      where: { id },
      data: { status: DriverAccountStatus.VALIDATED, isVerifiedBadge: true },
    });
    await this.audit.log({
      actorId,
      entityType: 'DriverProfile',
      entityId: id,
      action: 'VERIFY',
    });
    await this.notifications.notify({
      userId: profile.userId,
      type: NotificationType.STATUS_CHANGE,
      channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      fallbackTitle: 'Compte validé',
      fallbackBody: 'Votre profil chauffeur a été vérifié — vous pouvez maintenant proposer des trajets.',
    });
    return profile;
  }

  async suspend(id: string, reason: string, actorId: string) {
    await this.findOne(id);
    const profile = await this.prisma.driverProfile.update({
      where: { id },
      data: { status: DriverAccountStatus.SUSPENDED },
    });
    await this.audit.log({
      actorId,
      entityType: 'DriverProfile',
      entityId: id,
      action: 'SUSPEND',
      diff: { reason },
    });
    return profile;
  }

  async reactivate(id: string, actorId: string) {
    await this.findOne(id);
    const profile = await this.prisma.driverProfile.update({
      where: { id },
      data: { status: DriverAccountStatus.VALIDATED },
    });
    await this.audit.log({
      actorId,
      entityType: 'DriverProfile',
      entityId: id,
      action: 'REACTIVATE',
    });
    return profile;
  }

  // -----------------------------------------------------------------------
  // Compteurs de réputation — incrémentés par les modules Trip/Shipment
  // (Lots 3/4). Centralisés ici pour que la définition de "que compte-t-on
  // comme complété/annulé" reste à un seul endroit (section 25/26).
  // -----------------------------------------------------------------------

  async incrementCompletedTrips(driverId: string): Promise<void> {
    await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { completedTripsCount: { increment: 1 } },
    });
  }

  async incrementCompletedShipments(driverId: string): Promise<void> {
    await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { completedShipmentsCount: { increment: 1 } },
    });
  }

  async incrementCancellations(driverId: string): Promise<void> {
    await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { cancellationCount: { increment: 1 } },
    });
  }

  // -----------------------------------------------------------------------
  // Documents du chauffeur (pièce d'identité, permis...) — section 5.
  // -----------------------------------------------------------------------

  /**
   * Étape 1/2 de l'envoi d'un document : génère une clé + une URL
   * d'upload signée, sans encore créer de ligne Document (voir la note
   * de StorageService). Le client fait ensuite le PUT direct vers le
   * stockage, puis confirme via uploadDocumentForUser avec cette même
   * storageKey.
   */
  async requestDocumentUploadUrlForUser(userId: string, dto: RequestUploadUrlDto) {
    const driverId = await this.getProfileIdForUser(userId);
    const storageKey = this.storageService.buildKey('driver', driverId, extensionForContentType(dto.contentType));
    const { uploadUrl, expiresInSeconds } = await this.storageService.createUploadUrl(storageKey, dto.contentType);
    return { storageKey, uploadUrl, expiresInSeconds };
  }

  /**
   * Même flux en 2 étapes que les documents d'identité, mais une clé
   * distincte (`driver-avatar` plutôt que `driver`) — une photo de
   * profil est destinée à être vue en permanence dans l'app (par les
   * clients, pas seulement le SuperAdmin), contrairement à une pièce
   * d'identité. Recommandé : configurer un accès public en lecture sur
   * ce seul préfixe dans le bucket R2 (voir STORAGE_PUBLIC_BASE_URL,
   * .env.example) pour une URL stable ; sans ça, createDownloadUrl
   * retombe sur une URL signée qui expirera après quelques minutes.
   */
  async requestPhotoUploadUrlForUser(userId: string, dto: RequestUploadUrlDto) {
    const driverId = await this.getProfileIdForUser(userId);
    const storageKey = this.storageService.buildKey('driver-avatar', driverId, extensionForContentType(dto.contentType));
    const { uploadUrl, expiresInSeconds } = await this.storageService.createUploadUrl(storageKey, dto.contentType);
    return { storageKey, uploadUrl, expiresInSeconds };
  }

  async confirmPhotoForUser(userId: string, dto: ConfirmPhotoDto) {
    const driverId = await this.getProfileIdForUser(userId);
    const photoUrl = await this.storageService.createDownloadUrl(dto.storageKey);
    return this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { photoUrl },
    });
  }

  async uploadDocumentForUser(userId: string, dto: CreateDocumentDto) {
    const driverId = await this.getProfileIdForUser(userId);
    return this.documentsService.create(DocumentOwnerType.DRIVER, driverId, dto);
  }

  async findDocumentsForUser(userId: string) {
    const driverId = await this.getProfileIdForUser(userId);
    return this.documentsService.findAllForOwner(DocumentOwnerType.DRIVER, driverId);
  }
}
