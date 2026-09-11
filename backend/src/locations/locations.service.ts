// backend/src/locations/locations.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { FindNearbyDto } from './dto/find-nearby.dto';

export interface NearbyLocationRow {
  id: string;
  label: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number;
}

/**
 * `geoPoint` est un type PostGIS (`Unsupported` pour Prisma Client) — il
 * ne peut être écrit ou lu qu'en SQL brut, jamais via les méthodes
 * générées (create/update/findMany...). Ce service centralise ce détail
 * pour qu'aucun autre module n'ait à écrire de SQL PostGIS lui-même
 * (voir la note d'implémentation en tête de schema.prisma).
 */
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('Localisation introuvable.');
    return location;
  }

  async create(dto: CreateLocationDto) {
    const location = await this.prisma.location.create({
      data: {
        label: dto.label,
        formattedAddress: dto.formattedAddress,
        latitude: dto.latitude,
        longitude: dto.longitude,
        geocodeTrust: dto.geocodeTrust,
        cityId: dto.cityId,
      },
    });

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.syncGeoPoint(location.id, dto.latitude, dto.longitude);
    }

    return location;
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.findOne(id);
    const location = await this.prisma.location.update({
      where: { id },
      data: {
        label: dto.label,
        formattedAddress: dto.formattedAddress,
        latitude: dto.latitude,
        longitude: dto.longitude,
        geocodeTrust: dto.geocodeTrust,
        cityId: dto.cityId,
      },
    });

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.syncGeoPoint(id, dto.latitude, dto.longitude);
    }

    return location;
  }

  /**
   * Recalcule la colonne géographique `geoPoint` à partir de
   * latitude/longitude — à appeler après toute création/mise à jour de
   * coordonnées. SRID 4326 = WGS84, le système utilisé par le GPS.
   */
  private async syncGeoPoint(locationId: string, latitude: number, longitude: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE locations
      SET "geoPoint" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      WHERE id = ${locationId};
    `;
  }

  /**
   * Recherche de proximité — implémente la recommandation Partie III
   * ("rayon de tolérance configurable + PostGIS") au lieu d'un simple
   * filtre latitude/longitude non indexé.
   */
  async findNearby(params: FindNearbyDto): Promise<NearbyLocationRow[]> {
    const radiusMeters = (params.radiusKm ?? 5) * 1000;
    const limit = params.limit ?? 20;

    return this.prisma.$queryRaw<NearbyLocationRow[]>`
      SELECT
        id,
        label,
        "formattedAddress" AS "formattedAddress",
        latitude,
        longitude,
        ST_Distance(
          "geoPoint",
          ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)::geography
        ) AS "distanceMeters"
      FROM locations
      WHERE "geoPoint" IS NOT NULL
        AND "deletedAt" IS NULL
        AND ST_DWithin(
          "geoPoint",
          ST_SetSRID(ST_MakePoint(${params.longitude}, ${params.latitude}), 4326)::geography,
          ${radiusMeters}
        )
      ORDER BY "distanceMeters" ASC
      LIMIT ${limit};
    `;
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.location.delete({ where: { id } }); // soft delete (middleware)
  }
}
