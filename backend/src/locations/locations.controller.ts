// backend/src/locations/locations.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { LocationsService } from './locations.service';
import { CurrentUserId } from './current-user-id.decorator';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { FindNearbyDto } from './dto/find-nearby.dto';
import { ResolveCityDto } from './dto/resolve-city.dto';
import { SearchSavedLocationsDto } from './dto/search-saved-locations.dto';

@ApiTags('Localisations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   * Toute personne authentifiée peut créer une localisation : c'est une
   * brique utilisée en continu par la création de trajets/envois (Lots
   * 3/4), pas une ressource gérée centralement comme les villes.
   * L'adresse est mémorisée pour l'utilisateur qui la crée et lui sera
   * proposée dans ses prochaines recherches (GET /locations/saved).
   */
  @Post()
  create(@Body() dto: CreateLocationDto, @CurrentUserId() userId: string | undefined) {
    return this.locationsService.create(dto, userId);
  }

  @Get('nearby')
  findNearby(@Query() query: FindNearbyDto) {
    return this.locationsService.findNearby(query);
  }

  /** Adresses déjà utilisées par l'utilisateur connecté (récentes, ou filtrées par `query`). */
  @Get('saved')
  findSaved(@Query() query: SearchSavedLocationsDto, @CurrentUserId() userId: string | undefined) {
    return this.locationsService.findSaved(userId, query);
  }

  /** Détecte la ville d'une adresse (par son nom, sinon par proximité). `city` vaut null si rien de fiable. */
  @Get('resolve-city')
  async resolveCity(@Query() query: ResolveCityDto) {
    return { city: await this.locationsService.resolveCity(query) };
  }

  /** Une adresse mémorisée vient d'être réutilisée : elle remonte dans les "Récentes" de l'utilisateur. */
  @Post(':id/use')
  markUsed(@Param('id') id: string, @CurrentUserId() userId: string | undefined) {
    return this.locationsService.markUsed(id, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.locationsService.softDelete(id);
  }
}