// backend/src/vehicles/vehicles.controller.ts
// [19/10/2026] v2 — GET /vehicles/:id et GET /vehicles/:id/documents n'étaient protégés que par la connexion : tout compte connecté pouvait
// lire la fiche et les papiers (carte grise, assurance…) d'un véhicule d'autrui. Désormais : le conducteur propriétaire, ou le personnel
// qui a vehicle.read dans son périmètre pays.
import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateDocumentDto } from '../documents/dto/create-document.dto';
import { RequestUploadUrlDto } from '../storage/dto/request-upload-url.dto';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';

@ApiTags('Véhicules')
@ApiBearerAuth()
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly driverProfilesService: DriverProfilesService,
    private readonly scope: CountryScopeService,
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
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assertCanRead(id, user);
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
  async findDocuments(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.assertCanRead(id, user);
    return this.vehiclesService.findDocuments(id);
  }

  @Permissions(PERMISSIONS.VEHICLE_READ)
  @Get()
  findAll(@Query() query: ListVehiclesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.vehiclesService.findAll(
      query,
      { verificationStatus: query.verificationStatus, driverId: query.driverId },
      this.scope.vehicleWhere(user, PERMISSIONS.VEHICLE_READ),
    );
  }

  @Permissions(PERMISSIONS.VEHICLE_VERIFY)
  @Patch(':id/verify')
  async verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertVehicle(user, PERMISSIONS.VEHICLE_VERIFY, id);
    return this.vehiclesService.verify(id, user.id);
  }

  @Permissions(PERMISSIONS.VEHICLE_VERIFY)
  @Patch(':id/reject')
  async reject(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertVehicle(user, PERMISSIONS.VEHICLE_VERIFY, id);
    return this.vehiclesService.reject(id, user.id);
  }

  /** Véhicule renvoyé seulement à son propriétaire ou au personnel autorisé (dans son périmètre pays) ; 404 si absent, 403 sinon. */
  private async assertCanRead(vehicleId: string, user: AuthenticatedUser) {
    const vehicle = await this.vehiclesService.findOne(vehicleId);
    if (user.permissions?.includes(PERMISSIONS.VEHICLE_READ)) {
      await this.scope.assertVehicle(user, PERMISSIONS.VEHICLE_READ, vehicleId);
      return vehicle;
    }
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id).catch(() => null);
    if (!driverId || driverId !== vehicle.driverId) {
      throw new ForbiddenException("Ce véhicule n'appartient pas à ce conducteur.");
    }
    return vehicle;
  }
}
