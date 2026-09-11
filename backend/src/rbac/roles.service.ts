// backend/src/rbac/roles.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  async create(dto: CreateRoleDto, actorId: string) {
    const existing = await this.prisma.role.findUnique({ where: { key: dto.key } });
    if (existing) throw new ConflictException(`Le rôle "${dto.key}" existe déjà.`);

    const role = await this.prisma.role.create({
      data: {
        key: dto.key,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissionKeys
          ? {
              create: await this.resolvePermissionLinks(dto.permissionKeys),
            }
          : undefined,
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

    if (dto.permissionKeys) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    }

    const role = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        permissions: dto.permissionKeys
          ? { create: await this.resolvePermissionLinks(dto.permissionKeys) }
          : undefined,
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

  private async resolvePermissionLinks(permissionKeys: string[]) {
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
    });
    const foundKeys = new Set(permissions.map((p) => p.key));
    const missing = permissionKeys.filter((k) => !foundKeys.has(k));
    if (missing.length > 0) {
      throw new NotFoundException(
        `Permission(s) inconnue(s) : ${missing.join(', ')}.`,
      );
    }
    return permissions.map((p) => ({ permissionId: p.id }));
  }
}
