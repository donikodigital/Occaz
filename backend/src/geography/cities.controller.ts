// backend/src/geography/cities.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CitiesService } from './cities.service';
import { CreateCityDto } from './dto/create-city.dto';

@ApiTags('Géographie — Villes')
@ApiBearerAuth()
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Public()
  @Get()
  findAll(@Query() query: PaginationQueryDto, @Query('countryId') countryId?: string) {
    return this.citiesService.findAll(query, countryId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.citiesService.findOne(id);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Post()
  create(@Body() dto: CreateCityDto) {
    return this.citiesService.create(dto);
  }
}
