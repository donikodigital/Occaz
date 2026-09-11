// backend/src/trips/trips.controller.ts
import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TripStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { TripsService } from './trips.service';
import { BookingsService } from './bookings.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { SearchTripsDto } from './dto/search-trips.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { TripStopInputDto } from './dto/trip-stop-input.dto';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';

@ApiTags('Trajets')
@ApiBearerAuth()
@Controller('trips')
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly bookingsService: BookingsService,
    private readonly driverProfilesService: DriverProfilesService,
  ) {}

  @Get('search')
  search(@Query() query: SearchTripsDto) {
    return this.tripsService.search(query);
  }

  @Get('mine')
  async findMine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.findAllForDriver(driverId, query);
  }

  @Post()
  async create(@Body() dto: CreateTripDto, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.create(driverId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tripsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTripDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.update(id, driverId, dto);
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.publish(id, driverId);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelTripDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.cancel(id, driverId, dto.reason);
  }

  @Post(':id/driver-arrived')
  async markDriverArrived(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.markDriverArrived(id, driverId);
  }

  @Post(':id/start')
  async startTrip(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.startTrip(id, driverId);
  }

  @Post(':id/arrived')
  async markArrived(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.markArrived(id, driverId);
  }

  @Post(':id/complete')
  async completeTrip(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.completeTrip(id, driverId);
  }

  @Post(':id/stops')
  async addStop(
    @Param('id') id: string,
    @Body() dto: TripStopInputDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.addStop(id, driverId, dto);
  }

  @Delete(':id/stops/:stopId')
  async removeStop(
    @Param('id') id: string,
    @Param('stopId') stopId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripsService.removeStop(id, stopId, driverId);
  }

  @Get(':id/bookings')
  async findBookings(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    // Liste des passagers/réservations : donnée sensible, réservée au
    // chauffeur propriétaire du trajet ou au support (BOOKING_READ).
    if (!user.permissions.includes(PERMISSIONS.BOOKING_READ)) {
      const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
      await this.tripsService.findOne(id).then((trip) => {
        if (trip.driverId !== driverId) {
          throw new ForbiddenException("Ce trajet n'appartient pas à ce chauffeur.");
        }
      });
    }
    return this.bookingsService.findAllForTrip(id);
  }

  @Permissions(PERMISSIONS.TRIP_READ)
  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: TripStatus,
    @Query('driverId') driverId?: string,
  ) {
    return this.tripsService.findAll(query, { status, driverId });
  }
}
