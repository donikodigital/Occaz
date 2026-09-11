// backend/src/rbac/user-roles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AssignRoleDto } from './dto/assign-role.dto';

export interface EffectivePermissions {
  permissions: string[];
  /** Pays pour lesquels au moins un rôle scopé a été attribué (vide = aucune restriction géographique explicite). */
  scopedCountryIds: string[];
}

@Injectable()
export class UserRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAllForUser(userId: string) {
    return this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } }, country: true },
    });
  }

  async assign(dto: AssignRoleDto, actorId: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: dto.userId } }),
      this.prisma.role.findUnique({ where: { id: dto.roleId } }),
    ]);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    if (!role) throw new NotFoundException('Rôle introuvable.');

    // On évite `upsert` sur la clé composite @@unique([userId, roleId, countryId]) :
    // Prisma type strictement `countryId` en `string` (non-nullable) dans les clés
    // composites, ce qui rend impossible un lookup direct avec `countryId: null`.
    // Un `findFirst` + `create` explicite contourne cette limitation proprement.
    const existing = await this.prisma.userRole.findFirst({
      where: {
        userId: dto.userId,
        roleId: dto.roleId,
        countryId: dto.countryId ?? null,
      },
    });

    const userRole =
      existing ??
      (await this.prisma.userRole.create({
        data: {
          userId: dto.userId,
          roleId: dto.roleId,
          countryId: dto.countryId,
        },
      }));

    await this.audit.log({
      actorId,
      entityType: 'UserRole',
      entityId: userRole.id,
      action: 'ASSIGN',
      diff: { ...dto },
    });
    return userRole;
  }

  async revoke(userRoleId: string, actorId: string) {
    const userRole = await this.prisma.userRole.findUnique({ where: { id: userRoleId } });
    if (!userRole) throw new NotFoundException('Attribution de rôle introuvable.');

    await this.prisma.userRole.delete({ where: { id: userRoleId } });
    await this.audit.log({
      actorId,
      entityType: 'UserRole',
      entityId: userRoleId,
      action: 'REVOKE',
    });
  }

  /**
   * Résout l'ensemble des permissions effectives d'un utilisateur à
   * travers tous ses rôles, ainsi que les pays sur lesquels il est
   * explicitement scopé (recommandation Partie II — portée géographique
   * du RBAC). Appelé à chaque authentification par JwtStrategy.
   */
  async getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const permissions = new Set<string>();
    const scopedCountryIds = new Set<string>();

    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.permissions) {
        permissions.add(rolePermission.permission.key);
      }
      if (userRole.countryId) {
        scopedCountryIds.add(userRole.countryId);
      }
    }

    return {
      permissions: Array.from(permissions),
      scopedCountryIds: Array.from(scopedCountryIds),
    };
  }
}