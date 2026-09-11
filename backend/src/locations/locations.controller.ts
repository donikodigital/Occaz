// backend/src/locations/locations.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { FindNearbyDto } from './dto/find-nearby.dto';

@ApiTags('Localisations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   * Toute personne authentifiée peut créer une localisation : c'est une
   * brique utilisée en continu par la création de trajets/envois (Lots
   * 3/4), pas une ressource gérée centralement comme les villes.
   */
  @Post()
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Get('nearby')
  findNearby(@Query() query: FindNearbyDto) {
    return this.locationsService.findNearby(query);
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
