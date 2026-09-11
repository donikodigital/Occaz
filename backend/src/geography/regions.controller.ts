// backend/src/geography/regions.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { RegionsService } from './regions.service';
import { CreateRegionDto } from './dto/create-region.dto';

@ApiTags('Géographie — Régions')
@ApiBearerAuth()
@Controller('regions')
export class RegionsController {
  constructor(private readonly regionsService: RegionsService) {}

  @Public()
  @Get()
  findAllByCountry(@Query('countryId') countryId: string) {
    return this.regionsService.findAllByCountry(countryId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.regionsService.findOne(id);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Post()
  create(@Body() dto: CreateRegionDto) {
    return this.regionsService.create(dto);
  }
}
