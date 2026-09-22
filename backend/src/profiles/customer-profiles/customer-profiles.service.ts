// backend/src/profiles/customer-profiles/customer-profiles.service.ts
// [21/09/2026] v3 — photo de profil : upload-url puis confirmation, même flux que le chauffeur (storageKey 'customer-avatar', URL publique).
//
// v2 — Ajout du champ address (texte libre, même esprit que Location.label)
// sur CustomerProfile. Seul createForUser change : il liste ses champs
// explicitement. updateForUser fait déjà `data: { ...dto }`, donc il
// prend automatiquement en compte address dès qu'il est dans le DTO —
// aucun changement nécessaire là.

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { StorageService } from '../../storage/storage.service';
import { RequestUploadUrlDto, extensionForContentType } from '../../storage/dto/request-upload-url.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/dto/pagination-response.dto';
import { CreateCustomerProfileDto } from './dto/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { ConfirmPhotoDto } from './dto/confirm-photo.dto';

@Injectable()
export class CustomerProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly storageService: StorageService,
  ) {}

  /** Même logique que DriverProfilesService.getProfileIdForUser — l'id du profil, pour les routes qui en ont besoin sans tout recharger. */
  async getProfileIdForUser(userId: string): Promise<string> {
    const profile = await this.prisma.customerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) {
      throw new NotFoundException('Aucun profil client pour cet utilisateur.');
    }
    return profile.id;
  }

  async findByUserId(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      include: { country: true, city: true },
    });
    if (!profile) {
      throw new NotFoundException(
        "Aucun profil client — complétez d'abord votre inscription.",
      );
    }
    return profile;
  }

  async findOne(id: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { id },
      include: { country: true, city: true },
    });
    if (!profile) throw new NotFoundException('Profil client introuvable.');
    return profile;
  }

  /**
   * Complète l'inscription d'un compte CUSTOMER créé lors de la vérification
   * OTP (voir AuthService.requestOtp) — un utilisateur ne peut avoir qu'un
   * seul profil client (contrainte @unique sur userId).
   */
  async createForUser(
    userId: string,
    accountType: AccountType,
    dto: CreateCustomerProfileDto,
  ) {
    if (accountType !== AccountType.CUSTOMER) {
      throw new ConflictException(
        "Seul un compte de type CUSTOMER peut créer un profil client.",
      );
    }
    const existing = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (existing) {
      throw new ConflictException('Un profil client existe déjà pour ce compte.');
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

      return tx.customerProfile.create({
        data: {
          userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          photoUrl: dto.photoUrl,
          countryId: dto.countryId,
          cityId: dto.cityId,
          address: dto.address,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        },
      });
    });

    await this.notifications.notify({
      userId,
      type: NotificationType.STATUS_CHANGE,
      channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
      fallbackTitle: 'Bienvenue chez Transport Partagé',
      fallbackBody: `Bienvenue ${dto.firstName} ! Votre compte est prêt.`,
    });

    return profile;
  }

  async updateForUser(userId: string, dto: UpdateCustomerProfileDto) {
    const profile = await this.findByUserId(userId);
    return this.prisma.customerProfile.update({
      where: { id: profile.id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  /**
   * Même flux en 2 étapes et même distinction `customer-avatar` que côté
   * chauffeur (DriverProfilesService.requestPhotoUploadUrlForUser) : une
   * photo de profil est vue en permanence dans l'app (par le chauffeur qui
   * accepte l'envoi ou la course), contrairement à une pièce d'identité.
   */
  async requestPhotoUploadUrlForUser(userId: string, dto: RequestUploadUrlDto) {
    const customerId = await this.getProfileIdForUser(userId);
    const storageKey = this.storageService.buildKey('customer-avatar', customerId, extensionForContentType(dto.contentType));
    const { uploadUrl, expiresInSeconds } = await this.storageService.createUploadUrl(storageKey, dto.contentType);
    return { storageKey, uploadUrl, expiresInSeconds };
  }

  /** `{ public: true }` — même choix que côté chauffeur (voir StorageService.createDownloadUrl) : une photo de profil doit rester affichable durablement, pas seulement 5 minutes. */
  async confirmPhotoForUser(userId: string, dto: ConfirmPhotoDto) {
    const customerId = await this.getProfileIdForUser(userId);
    const photoUrl = await this.storageService.createDownloadUrl(dto.storageKey, { public: true });
    return this.prisma.customerProfile.update({ where: { id: customerId }, data: { photoUrl } });
  }

  async findAll(
    query: PaginationQueryDto,
    countryId?: string,
  ): Promise<PaginatedResult<unknown>> {
    const where = {
      countryId,
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
      this.prisma.customerProfile.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { country: true, city: true },
      }),
      this.prisma.customerProfile.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** Suppression douce (RGPD / demande utilisateur) — voir middleware de soft delete. */
  async softDelete(id: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.customerProfile.delete({ where: { id } });
    await this.audit.log({
      actorId,
      entityType: 'CustomerProfile',
      entityId: id,
      action: 'SOFT_DELETE',
    });
  }
}