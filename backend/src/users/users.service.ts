// backend/src/users/users.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

/** Vue "sûre" d'un utilisateur — ne contient jamais passwordHash / twoFactorSecret. */
export type SafeUser = Omit<User, 'passwordHash' | 'twoFactorSecret'> & {
  firstName: string | null;
  lastName: string | null;
};

/**
 * Le prénom/nom vivent sur CustomerProfile/DriverProfile (User n'en a pas)
 * — ces deux relations sont jointes ici uniquement pour les dénormaliser
 * sur SafeUser.firstName/lastName, pratique pour l'affichage back-office
 * (liste, recherche par nom) sans interroger trois modèles séparément
 * côté front.
 */
type UserWithProfileNames = User & {
  customerProfile?: { firstName: string; lastName: string } | null;
  driverProfile?: { firstName: string; lastName: string } | null;
};

const PROFILE_NAME_INCLUDE = {
  customerProfile: { select: { firstName: true, lastName: true } },
  driverProfile: { select: { firstName: true, lastName: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  toSafeUser(user: UserWithProfileNames): SafeUser {
    const { passwordHash, twoFactorSecret, customerProfile, driverProfile, ...safe } = user;
    const profile = customerProfile ?? driverProfile ?? null;
    return { ...safe, firstName: profile?.firstName ?? null, lastName: profile?.lastName ?? null };
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async getSafeById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: PROFILE_NAME_INCLUDE });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return this.toSafeUser(user);
  }

  async createUser(data: {
    phone: string;
    accountType: AccountType;
    email?: string;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async updateSelf(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.prisma.user.update({ where: { id }, data: dto, include: PROFILE_NAME_INCLUDE });
    return this.toSafeUser(user);
  }

  /**
   * Mise à jour par un administrateur (email + prénom/nom). Le
   * prénom/nom ne peuvent être modifiés que si un profil client ou
   * chauffeur existe déjà — Support/SuperAdmin n'en ont pas.
   */
  async adminUpdate(id: string, dto: AdminUpdateUserDto, actorId: string): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: PROFILE_NAME_INCLUDE });
    if (!existing) throw new NotFoundException('Utilisateur introuvable.');

    if (dto.email !== undefined) {
      try {
        await this.prisma.user.update({ where: { id }, data: { email: dto.email } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Cette adresse email est déjà utilisée par un autre compte.');
        }
        throw error;
      }
    }

    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const nameData = {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      };
      if (existing.customerProfile) {
        await this.prisma.customerProfile.update({ where: { userId: id }, data: nameData });
      } else if (existing.driverProfile) {
        await this.prisma.driverProfile.update({ where: { userId: id }, data: nameData });
      } else {
        throw new BadRequestException("Cet utilisateur n'a pas de profil client ou chauffeur à modifier.");
      }
    }

    await this.audit.log({ actorId, entityType: 'User', entityId: id, action: 'UPDATE', diff: { ...dto } });

    return this.getSafeById(id);
  }

  async findAll(
    query: PaginationQueryDto,
    accountType?: AccountType,
  ): Promise<PaginatedResult<SafeUser>> {
    const where = {
      accountType,
      ...(query.search
        ? {
            OR: [
              { phone: { contains: query.search } },
              { email: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: PROFILE_NAME_INCLUDE,
      }),
      this.prisma.user.count({ where }),
    ]);
    return new PaginatedResult(
      users.map((u) => this.toSafeUser(u)),
      total,
      query.page,
      query.limit,
    );
  }

  async suspend(id: string, reason: string, actorId: string): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isSuspended: true, suspendedReason: reason },
      include: PROFILE_NAME_INCLUDE,
    });
    await this.audit.log({
      actorId,
      entityType: 'User',
      entityId: id,
      action: 'SUSPEND',
      diff: { reason },
    });
    return this.toSafeUser(user);
  }

  async unsuspend(id: string, actorId: string): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isSuspended: false, suspendedReason: null },
      include: PROFILE_NAME_INCLUDE,
    });
    await this.audit.log({
      actorId,
      entityType: 'User',
      entityId: id,
      action: 'UNSUSPEND',
    });
    return this.toSafeUser(user);
  }

  /**
   * Aucune suppression physique (trop de données liées : réservations,
   * portefeuille, sessions...) — même principe que Country.deactivate.
   * "Supprimer" dans l'UI admin désactive le compte (isActive: false).
   */
  async deactivate(id: string, actorId: string): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: PROFILE_NAME_INCLUDE,
    });
    await this.audit.log({ actorId, entityType: 'User', entityId: id, action: 'DEACTIVATE' });
    return this.toSafeUser(user);
  }

  async activate(id: string, actorId: string): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      include: PROFILE_NAME_INCLUDE,
    });
    await this.audit.log({ actorId, entityType: 'User', entityId: id, action: 'ACTIVATE' });
    return this.toSafeUser(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}