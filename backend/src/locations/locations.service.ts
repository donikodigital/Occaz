// backend/src/locations/locations.service.ts
//
// v2 — Ajouts :
//  - resolveCity : retrouve la ville d'une adresse (par son nom dans le
//    texte, sinon par la ville la plus proche des coordonnées) pour ne
//    plus demander la ville à l'utilisateur dans le cas courant ;
//  - create : si `cityId` est absent, tente la détection automatique, et
//    réutilise l'adresse déjà mémorisée par l'utilisateur plutôt que de
//    créer un doublon ;
//  - findSaved / markUsed : mémoire des adresses par utilisateur
//    (SavedLocation), proposées en premier lors des recherches.
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { FindNearbyDto } from './dto/find-nearby.dto';
import { ResolveCityDto } from './dto/resolve-city.dto';
import { SearchSavedLocationsDto } from './dto/search-saved-locations.dto';

export interface NearbyLocationRow {
  id: string;
  label: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number;
}

export interface ResolvedCity {
  id: string;
  name: string;
  countryId: string;
  prefectureId: string | null;
}

export interface SavedLocationView {
  id: string;
  label: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  cityId: string | null;
  cityName: string | null;
  usageCount: number;
  lastUsedAt: Date;
}

interface CityCandidate extends ResolvedCity {
  latitude: number | null;
  longitude: number | null;
  normalizedName: string;
}

/**
 * Les villes changent rarement, mais une ville (ou ses coordonnées) ajoutée
 * dans l'admin doit être prise en compte vite : un cache d'une minute évite
 * de relire la table à chaque recherche sans faire attendre la détection.
 */
const CITIES_CACHE_TTL_MS = 60_000;
/** Au-delà, la ville la plus proche n'est plus fiable : on préfère demander à l'utilisateur. */
const NEAREST_CITY_MAX_KM = 60;
/** Deux adresses de même libellé dans la même ville sont fusionnées si elles sont à moins de cette distance. */
const SAME_PLACE_MAX_KM = 0.15;
const EARTH_RADIUS_KM = 6371;

/** Minuscules, sans accents, sans ponctuation : "Labé" et "labe" se comparent égaux. */
function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
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
  private citiesCache: { loadedAt: number; rows: CityCandidate[] } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('Localisation introuvable.');
    return location;
  }

  /**
   * `userId` (facultatif) : quand il est fourni, l'adresse est mémorisée
   * pour cet utilisateur et proposée en premier lors de ses prochaines
   * recherches. Un même libellé dans la même ville (à moins de 150 m si
   * les deux ont des coordonnées) réutilise l'adresse existante.
   */
  async create(dto: CreateLocationDto, userId?: string) {
    const label = dto.label.trim();
    const cityId = dto.cityId ?? (await this.detectCityId({ ...dto, label }));

    if (userId) {
      const existing = await this.findSavedDuplicate(userId, label, cityId, dto.latitude, dto.longitude);
      if (existing) {
        await this.recordUsage(userId, existing.id);
        return existing;
      }
    }

    const location = await this.prisma.location.create({
      data: {
        label,
        formattedAddress: dto.formattedAddress,
        latitude: dto.latitude,
        longitude: dto.longitude,
        geocodeTrust: dto.geocodeTrust,
        cityId,
      },
    });

    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.syncGeoPoint(location.id, dto.latitude, dto.longitude);
    }

    if (userId) {
      await this.recordUsage(userId, location.id);
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

  // ---------------------------------------------------------------------
  // Détection automatique de la ville
  // ---------------------------------------------------------------------

  /**
   * Trouve la ville d'une adresse en deux temps :
   *  1. par le nom — si le texte de l'adresse contient le nom d'une ville
   *     connue (ex : "…, Conakry, Guinée"). S'il y en a plusieurs, on garde
   *     la plus proche des coordonnées, à défaut le nom le plus long ;
   *  2. sinon, par la ville la plus proche des coordonnées (60 km max).
   * Renvoie `null` si aucune des deux pistes n'aboutit : c'est alors à
   * l'utilisateur de choisir la ville.
   */
  async resolveCity(params: ResolveCityDto): Promise<ResolvedCity | null> {
    const cities = await this.loadCities();
    if (cities.length === 0) return null;

    const point =
      params.latitude !== undefined && params.longitude !== undefined
        ? { latitude: params.latitude, longitude: params.longitude }
        : null;

    const distanceKm = (city: CityCandidate): number | null =>
      point && city.latitude !== null && city.longitude !== null
        ? haversineKm(point.latitude, point.longitude, city.latitude, city.longitude)
        : null;

    const haystack = params.address ? ` ${normalizeText(params.address)} ` : '';
    const byName = haystack
      ? cities.filter((city) => city.normalizedName.length >= 3 && haystack.includes(` ${city.normalizedName} `))
      : [];

    if (byName.length > 0) {
      const sorted = [...byName].sort((a, b) => {
        const distanceA = distanceKm(a) ?? Number.POSITIVE_INFINITY;
        const distanceB = distanceKm(b) ?? Number.POSITIVE_INFINITY;
        if (distanceA !== distanceB) return distanceA - distanceB;
        return b.normalizedName.length - a.normalizedName.length;
      });
      const best = sorted[0];
      if (best) return this.toResolvedCity(best);
    }

    if (point) {
      let nearest: { city: CityCandidate; km: number } | null = null;
      for (const city of cities) {
        const km = distanceKm(city);
        if (km === null) continue;
        if (!nearest || km < nearest.km) nearest = { city, km };
      }
      if (nearest && nearest.km <= NEAREST_CITY_MAX_KM) return this.toResolvedCity(nearest.city);
    }

    return null;
  }

  private async detectCityId(dto: CreateLocationDto): Promise<string | undefined> {
    const address = [dto.label, dto.formattedAddress].filter(Boolean).join(', ');
    const hasPoint = dto.latitude !== undefined && dto.longitude !== undefined;
    if (!address && !hasPoint) return undefined;

    const city = await this.resolveCity({
      latitude: dto.latitude,
      longitude: dto.longitude,
      address,
    });
    return city?.id;
  }

  private toResolvedCity(city: CityCandidate): ResolvedCity {
    return { id: city.id, name: city.name, countryId: city.countryId, prefectureId: city.prefectureId };
  }

  private async loadCities(): Promise<CityCandidate[]> {
    const now = Date.now();
    if (this.citiesCache && now - this.citiesCache.loadedAt < CITIES_CACHE_TTL_MS) {
      return this.citiesCache.rows;
    }

    const cities = await this.prisma.city.findMany({
      select: {
        id: true,
        name: true,
        countryId: true,
        prefectureId: true,
        latitude: true,
        longitude: true,
      },
    });
    const rows = cities.map((city) => ({ ...city, normalizedName: normalizeText(city.name) }));
    this.citiesCache = { loadedAt: now, rows };
    return rows;
  }

  // ---------------------------------------------------------------------
  // Mémoire des adresses par utilisateur (SavedLocation)
  // ---------------------------------------------------------------------

  /**
   * Adresses déjà utilisées par l'utilisateur. Sans texte de recherche :
   * les plus récentes (liste "Récentes"). Avec un texte : celles dont le
   * libellé, l'adresse ou la ville correspondent, les plus utilisées d'abord.
   */
  async findSaved(userId: string | undefined, dto: SearchSavedLocationsDto): Promise<SavedLocationView[]> {
    if (!userId) return [];

    const query = dto.query?.trim();
    const limit = dto.limit ?? 8;
    const insensitive = Prisma.QueryMode.insensitive;

    const orderBy: Prisma.SavedLocationOrderByWithRelationInput[] = query
      ? [{ usageCount: 'desc' }, { lastUsedAt: 'desc' }]
      : [{ lastUsedAt: 'desc' }];

    const rows = await this.prisma.savedLocation.findMany({
      where: {
        userId,
        location: {
          deletedAt: null,
          ...(query
            ? {
                OR: [
                  { label: { contains: query, mode: insensitive } },
                  { formattedAddress: { contains: query, mode: insensitive } },
                  { city: { name: { contains: query, mode: insensitive } } },
                ],
              }
            : {}),
        },
      },
      orderBy,
      take: limit,
      include: { location: { include: { city: { select: { id: true, name: true } } } } },
    });

    return rows.map((row) => ({
      id: row.location.id,
      label: row.location.label,
      formattedAddress: row.location.formattedAddress,
      latitude: row.location.latitude,
      longitude: row.location.longitude,
      cityId: row.location.cityId,
      cityName: row.location.city?.name ?? null,
      usageCount: row.usageCount,
      lastUsedAt: row.lastUsedAt,
    }));
  }

  /** À appeler quand l'utilisateur choisit une adresse déjà mémorisée : elle remonte dans ses "Récentes". */
  async markUsed(locationId: string, userId?: string): Promise<{ success: boolean }> {
    await this.findOne(locationId);
    if (userId) await this.recordUsage(userId, locationId);
    return { success: true };
  }

  private async recordUsage(userId: string, locationId: string): Promise<void> {
    await this.prisma.savedLocation.upsert({
      where: { userId_locationId: { userId, locationId } },
      create: { userId, locationId },
      update: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  }

  /**
   * "Rond-Point" est un libellé Mapbox très courant : deux endroits
   * différents peuvent le porter. On ne réutilise donc une adresse que si
   * la ville est la même ET que les positions concordent (ou qu'aucune des
   * deux n'a de position).
   */
  private async findSavedDuplicate(
    userId: string,
    label: string,
    cityId: string | undefined,
    latitude: number | undefined,
    longitude: number | undefined,
  ) {
    const candidates = await this.prisma.location.findMany({
      where: {
        deletedAt: null,
        label: { equals: label, mode: Prisma.QueryMode.insensitive },
        cityId: cityId ?? null,
        savedBy: { some: { userId } },
      },
      take: 10,
    });

    const point = latitude !== undefined && longitude !== undefined ? { latitude, longitude } : null;
    return (
      candidates.find((candidate) => {
        const candidatePoint =
          candidate.latitude !== null && candidate.longitude !== null
            ? { latitude: candidate.latitude, longitude: candidate.longitude }
            : null;
        if (!point && !candidatePoint) return true;
        if (point && candidatePoint) {
          return (
            haversineKm(point.latitude, point.longitude, candidatePoint.latitude, candidatePoint.longitude) <=
            SAME_PLACE_MAX_KM
          );
        }
        return false;
      }) ?? null
    );
  }
}