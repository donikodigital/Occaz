// backend/src/geography/cities.service.ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto, countryId?: string): Promise<PaginatedResult<unknown>> {
    const where: Prisma.CityWhereInput = {
      countryId,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
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

  async update(id: string, dto: UpdateCityDto) {
    await this.findOne(id);
    return this.prisma.city.update({ where: { id }, data: dto });
  }

  /**
   * Bloqué si la ville est encore référencée ailleurs (chauffeurs, trajets,
   * clients, localisations) — une suppression physique casserait ces
   * relations en base plutôt que de lever une erreur claire.
   */
  async remove(id: string) {
    await this.findOne(id);

    const [driver, tripOrigin, tripDestination, customer, location] = await Promise.all([
      this.prisma.driverProfile.findFirst({ where: { cityId: id } }),
      this.prisma.trip.findFirst({ where: { originCityId: id } }),
      this.prisma.trip.findFirst({ where: { destinationCityId: id } }),
      this.prisma.customerProfile.findFirst({ where: { cityId: id } }),
      this.prisma.location.findFirst({ where: { cityId: id } }),
    ]);

    if (driver) throw new ConflictException('Cette ville est associée à au moins un chauffeur — impossible de la supprimer.');
    if (tripOrigin || tripDestination) {
      throw new ConflictException("Cette ville est utilisée comme origine ou destination d'un trajet — impossible de la supprimer.");
    }
    if (customer) throw new ConflictException('Cette ville est associée à au moins un client — impossible de la supprimer.');
    if (location) throw new ConflictException('Cette ville est référencée par au moins une localisation enregistrée — impossible de la supprimer.');

    await this.prisma.city.delete({ where: { id } });
  }
}