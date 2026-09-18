// backend/src/geography/currencies.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@ApiTags('Géographie — Devises')
@ApiBearerAuth()
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Public()
  @Get()
  findAll() {
    return this.currenciesService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.currenciesService.findOne(id);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Post()
  create(@Body() dto: CreateCurrencyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.currenciesService.create(dto, user.id);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCurrencyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.currenciesService.update(id, dto, user.id);
  }

  @Permissions(PERMISSIONS.GEOGRAPHY_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.currenciesService.remove(id, user.id);
  }
}