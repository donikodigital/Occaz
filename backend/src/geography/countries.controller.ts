// backend/src/geography/countries.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CountriesService } from './countries.service';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';

@ApiTags('Géographie — Pays')
@ApiBearerAuth()
@Controller('countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Public()
  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.countriesService.findAll(includeInactive !== 'true');
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.countriesService.findOne(id);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Post()
  create(@Body() dto: CreateCountryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.countriesService.create(dto, user.id);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCountryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.countriesService.update(id, dto, user.id);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.countriesService.deactivate(id, user.id);
  }
}
