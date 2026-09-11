// backend/src/rbac/permissions.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async create(dto: CreatePermissionDto) {
    const existing = await this.prisma.permission.findUnique({
      where: { key: dto.key },
    });
    if (existing) {
      throw new ConflictException(`La permission "${dto.key}" existe déjà.`);
    }
    return this.prisma.permission.create({ data: dto });
  }

  /** Crée la permission si elle n'existe pas encore — utilisé par le seed RBAC. */
  async ensureExists(key: string, description?: string) {
    return this.prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description },
    });
  }
}
