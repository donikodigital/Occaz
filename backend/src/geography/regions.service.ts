// backend/src/geography/regions.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByCountry(countryId: string) {
    return this.prisma.region.findMany({ where: { countryId }, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const region = await this.prisma.region.findUnique({ where: { id } });
    if (!region) throw new NotFoundException('Région introuvable.');
    return region;
  }

  create(dto: CreateRegionDto) {
    return this.prisma.region.create({ data: dto });
  }

  async update(id: string, dto: UpdateRegionDto) {
    await this.findOne(id);
    return this.prisma.region.update({ where: { id }, data: dto });
  }

  /** Bloqué si une préfecture dépend encore de cette région. */
  async remove(id: string) {
    await this.findOne(id);
    const usedByPrefecture = await this.prisma.prefecture.findFirst({ where: { regionId: id } });
    if (usedByPrefecture) {
      throw new ConflictException(
        `Cette région contient encore des préfectures (ex. "${usedByPrefecture.name}") — supprime-les d'abord.`,
      );
    }
    await this.prisma.region.delete({ where: { id } });
  }
}