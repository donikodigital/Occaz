// backend/src/rbac/roles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Rôle introuvable.');
    return role;
  }

  private async resolvePermissionIds(permissionKeys: string[]): Promise<string[]> {
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
    });
    const found = new Set(permissions.map((p) => p.key));
    const missing = permissionKeys.filter((key) => !found.has(key));
    if (missing.length > 0) {
      throw new NotFoundException(`Permission(s) introuvable(s) : ${missing.join(', ')}`);
    }
    return permissions.map((p) => p.id);
  }

  async create(dto: CreateRoleDto, actorId: string) {
    const permissionIds = dto.permissionKeys?.length
      ? await this.resolvePermissionIds(dto.permissionKeys)
      : [];

    const role = await this.prisma.role.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    await this.audit.log({
      actorId,
      entityType: 'Role',
      entityId: role.id,
      action: 'CREATE',
      diff: { ...dto },
    });
    return role;
  }

  async update(id: string, dto: UpdateRoleDto, actorId: string) {
    await this.findOne(id);

    // Si des permissionKeys sont fournies, on resynchronise entièrement la
    // relation (delete + recreate) plutôt que de calculer un diff — plus
    // simple et sûr pour une liste de taille modeste comme les permissions
    // d'un rôle.
    if (dto.permissionKeys) {
      const permissionIds = await this.resolvePermissionIds(dto.permissionKeys);
      await this.prisma.$transaction([
        this.prisma.rolePermission.deleteMany({ where: { roleId: id } }),
        this.prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
        }),
      ]);
    }

    const role = await this.prisma.role.update({
      where: { id },
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
      },
      include: { permissions: { include: { permission: true } } },
    });

    await this.audit.log({
      actorId,
      entityType: 'Role',
      entityId: id,
      action: 'UPDATE',
      diff: { ...dto },
    });
    return role;
  }
}