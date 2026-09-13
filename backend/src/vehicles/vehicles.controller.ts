// backend/src/vehicles/vehicles.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateDocumentDto } from '../documents/dto/create-document.dto';
import { RequestUploadUrlDto } from '../storage/dto/request-upload-url.dto';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';

@ApiTags('Véhicules')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly driverProfilesService: DriverProfilesService,
  ) {}

  @Get('mine')
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.vehiclesService.findAllForDriver(driverId);
  }

  @Post()
  async create(@Body() dto: CreateVehicleDto, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.vehiclesService.create(driverId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.vehiclesService.update(id, driverId, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.vehiclesService.remove(id, driverId);
  }

  @Post(':id/documents/upload-url')
  async requestDocumentUploadUrl(
    @Param('id') id: string,
    @Body() dto: RequestUploadUrlDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.vehiclesService.requestDocumentUploadUrl(id, driverId, dto);
  }

  @Post(':id/documents')
  async uploadDocument(
    @Param('id') id: string,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.vehiclesService.uploadDocument(id, driverId, dto);
  }

  @Get(':id/documents')
  findDocuments(@Param('id') id: string) {
    return this.vehiclesService.findDocuments(id);
  }

  @Permissions(PERMISSIONS.VEHICLE_READ)
  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('verificationStatus') verificationStatus?: DocumentStatus,
    @Query('driverId') driverId?: string,
  ) {
    return this.vehiclesService.findAll(query, { verificationStatus, driverId });
  }

  @Permissions(PERMISSIONS.VEHICLE_VERIFY)
  @Patch(':id/verify')
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.verify(id, user.id);
  }

  @Permissions(PERMISSIONS.VEHICLE_VERIFY)
  @Patch(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.reject(id, user.id);
  }
}
