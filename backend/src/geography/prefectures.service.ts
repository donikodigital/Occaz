// backend/src/geography/prefectures.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrefectureDto } from './dto/create-prefecture.dto';
import { UpdatePrefectureDto } from './dto/update-prefecture.dto';

@Injectable()
export class PrefecturesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByRegion(regionId: string) {
    return this.prisma.prefecture.findMany({ where: { regionId }, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const prefecture = await this.prisma.prefecture.findUnique({ where: { id } });
    if (!prefecture) throw new NotFoundException('Préfecture introuvable.');
    return prefecture;
  }

  create(dto: CreatePrefectureDto) {
    return this.prisma.prefecture.create({ data: dto });
  }

  async update(id: string, dto: UpdatePrefectureDto) {
    await this.findOne(id);
    return this.prisma.prefecture.update({ where: { id }, data: dto });
  }

  /** Bloqué si une ville dépend encore de cette préfecture. */
  async remove(id: string) {
    await this.findOne(id);
    const usedByCity = await this.prisma.city.findFirst({ where: { prefectureId: id } });
    if (usedByCity) {
      throw new ConflictException(
        `Cette préfecture contient encore des villes (ex. "${usedByCity.name}") — supprime-les d'abord.`,
      );
    }
    await this.prisma.prefecture.delete({ where: { id } });
  }
}