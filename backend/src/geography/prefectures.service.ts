// backend/src/geography/prefectures.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrefectureDto } from './dto/create-prefecture.dto';

@Injectable()
export class PrefecturesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByRegion(regionId: string) {
    return this.prisma.prefecture.findMany({
      where: { regionId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const prefecture = await this.prisma.prefecture.findUnique({ where: { id } });
    if (!prefecture) throw new NotFoundException('Préfecture introuvable.');
    return prefecture;
  }

  create(dto: CreatePrefectureDto) {
    return this.prisma.prefecture.create({ data: dto });
  }
}
