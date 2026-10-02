// backend/src/rbac/user-roles.service.ts
// [02/10/2026] v+ — Portée géographique appliquée : getEffectivePermissions() calcule, par permission, les pays
// auxquels elle est limitée (voir common/scope/country-scope.ts) ; assign() vérifie que le pays existe.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AssignRoleDto } from './dto/assign-role.dto';
import { EffectivePermissions, resolveEffectivePermissions } from '../common/scope/country-scope';

export type { EffectivePermissions };

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
    if (dto.countryId) {
      const country = await this.prisma.country.findUnique({ where: { id: dto.countryId }, select: { id: true } });
      if (!country) throw new NotFoundException('Pays introuvable.');
    }

    // Même limitation que dans accounts.seed.ts : la clé composite
    // @@unique([userId, roleId, countryId]) type `countryId` en `string`
    // non-nullable côté client Prisma réel, incompatible avec un lookup
    // `countryId: null` — on passe donc par un findFirst + create explicite
    // plutôt qu'un upsert.
    const existing = await this.prisma.userRole.findFirst({
      where: { userId: dto.userId, roleId: dto.roleId, countryId: dto.countryId ?? null },
    });
    const userRole =
      existing ??
      (await this.prisma.userRole.create({
        data: { userId: dto.userId, roleId: dto.roleId, countryId: dto.countryId },
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

    return resolveEffectivePermissions(
      userRoles.map((userRole) => ({
        countryId: userRole.countryId,
        permissionKeys: userRole.role.permissions.map((rolePermission) => rolePermission.permission.key),
      })),
    );
  }
}