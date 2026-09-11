// backend/src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountType, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** Vue "sûre" d'un utilisateur — ne contient jamais passwordHash / twoFactorSecret. */
export type SafeUser = Omit<User, 'passwordHash' | 'twoFactorSecret'>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  toSafeUser(user: User): SafeUser {
    const { passwordHash, twoFactorSecret, ...safe } = user;
    return safe;
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
    const user = await this.findById(id);
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
    const user = await this.prisma.user.update({ where: { id }, data: dto });
    return this.toSafeUser(user);
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
    });
    await this.audit.log({
      actorId,
      entityType: 'User',
      entityId: id,
      action: 'UNSUSPEND',
    });
    return this.toSafeUser(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}
