// backend/src/geography/regions.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegionDto } from './dto/create-region.dto';

@Injectable()
export class RegionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByCountry(countryId: string) {
    return this.prisma.region.findMany({
      where: { countryId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const region = await this.prisma.region.findUnique({ where: { id } });
    if (!region) throw new NotFoundException('Région introuvable.');
    return region;
  }

  create(dto: CreateRegionDto) {
    return this.prisma.region.create({ data: dto });
  }
}
