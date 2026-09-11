// backend/src/geography/cities.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCityDto } from './dto/create-city.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: PaginationQueryDto,
    countryId?: string,
  ): Promise<PaginatedResult<unknown>> {
    const where: Prisma.CityWhereInput = {
      countryId,
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.city.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.city.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const city = await this.prisma.city.findUnique({ where: { id } });
    if (!city) throw new NotFoundException('Ville introuvable.');
    return city;
  }

  create(dto: CreateCityDto) {
    return this.prisma.city.create({ data: dto });
  }
}
