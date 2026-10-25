// backend/src/deals/deals.controller.ts
// [25/10/2026] v+ — GET /deals/:id ne renvoie un bon plan inactif ou hors période qu'à la gestion des promotions ; PATCH validé (UpdateDealDto).
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { DealsService } from './deals.service';
import { UpsertDealDto } from './dto/upsert-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

@ApiTags('Bons plans')
@ApiBearerAuth()
@Controller('deals')
export class DealsController {
  constructor(private readonly dealsService: DealsService) {}

  @Get('active')
  findActive(@Query('countryId') countryId?: string) {
    return this.dealsService.findActive(countryId);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.dealsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const canSeeAll = user.permissions.includes(PERMISSIONS.PROMOTION_MANAGE);
    return canSeeAll ? this.dealsService.findOne(id) : this.dealsService.findOneActive(id);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Post()
  create(@Body() dto: UpsertDealDto) {
    return this.dealsService.create(dto);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDealDto) {
    return this.dealsService.update(id, dto);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.dealsService.remove(id);
  }
}