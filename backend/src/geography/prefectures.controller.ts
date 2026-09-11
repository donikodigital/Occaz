// backend/src/geography/prefectures.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PrefecturesService } from './prefectures.service';
import { CreatePrefectureDto } from './dto/create-prefecture.dto';

@ApiTags('Géographie — Préfectures')
@ApiBearerAuth()
@Controller('prefectures')
export class PrefecturesController {
  constructor(private readonly prefecturesService: PrefecturesService) {}

  @Public()
  @Get()
  findAllByRegion(@Query('regionId') regionId: string) {
    return this.prefecturesService.findAllByRegion(regionId);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prefecturesService.findOne(id);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Post()
  create(@Body() dto: CreatePrefectureDto) {
    return this.prefecturesService.create(dto);
  }
}
