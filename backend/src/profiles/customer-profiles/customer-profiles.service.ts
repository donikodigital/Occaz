// backend/src/profiles/customer-profiles/customer-profiles.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, NotificationChannel, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResult } from '../../common/dto/pagination-response.dto';
import { CreateCustomerProfileDto } from './dto/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';

@Injectable()
export class CustomerProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

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
