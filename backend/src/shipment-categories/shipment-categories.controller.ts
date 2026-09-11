// backend/src/shipment-categories/shipment-categories.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { ShipmentCategoriesService } from './shipment-categories.service';
import { CreateShipmentCategoryDto } from './dto/create-shipment-category.dto';
import { UpdateShipmentCategoryDto } from './dto/update-shipment-category.dto';

@ApiTags('Envois — Catégories')
@ApiBearerAuth()
@Controller('shipment-categories')
export class ShipmentCategoriesController {
  constructor(private readonly shipmentCategoriesService: ShipmentCategoriesService) {}

  @Get('usable')
  findAllUsable(@Query('countryId') countryId?: string) {
    return this.shipmentCategoriesService.findAllUsable(countryId);
  }

  @Permissions(PERMISSIONS.SHIPMENT_CATEGORY_MANAGE)
  @Get()
  findAll() {
    return this.shipmentCategoriesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shipmentCategoriesService.findOne(id);
  }

  @Permissions(PERMISSIONS.SHIPMENT_CATEGORY_MANAGE)
  @Post()
  create(@Body() dto: CreateShipmentCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.shipmentCategoriesService.create(dto, user.id);
  }

  @Permissions(PERMISSIONS.SHIPMENT_CATEGORY_MANAGE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shipmentCategoriesService.update(id, dto, user.id);
  }
}
