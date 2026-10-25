// backend/src/trips/bookings.controller.ts
// [19/10/2026] v+ — un conducteur ne réserve pas son propre trajet (SelfDealingService) ; le rôle se déduit des profils, plus du type de compte.
import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { CustomerProfilesService } from '../profiles/customer-profiles/customer-profiles.service';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';
import { TripOtpService } from './trip-otp.service';
import { TripCompletionService } from './trip-completion.service';
import { hideContactsOnceCompleted } from './booking-contacts';
import { UserBlocksService } from '../user-safety/user-blocks.service';
import { SelfDealingService } from '../account-roles/self-dealing.service';

@ApiTags('Réservations')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly customerProfilesService: CustomerProfilesService,
    private readonly driverProfilesService: DriverProfilesService,
    private readonly tripOtpService: TripOtpService,
    private readonly scope: CountryScopeService,
    private readonly userBlocks: UserBlocksService,
    private readonly selfDealing: SelfDealingService,
    private readonly tripCompletion: TripCompletionService,
  ) {}

  @Get('mine')
  async findMine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customerProfilesService.findByUserId(user.id);
    return this.bookingsService.findMineForCustomer(customer.id, query);
  }

  @Post()
  async create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customerProfilesService.findByUserId(user.id);
    // Blocage dans un sens ou dans l'autre : pas de réservation chez ce conducteur.
    await this.userBlocks.assertCanBookTrip(user.id, dto.tripId);
    // Un conducteur qui a aussi un profil passager ne réserve pas son propre trajet.
    await this.selfDealing.assertNotOwnTrip(user.id, dto.tripId);
    return this.bookingsService.create(customer.id, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const booking = (await this.bookingsService.findOne(id)) as unknown as {
      customerId: string;
      status: string;
      driverPhone: string | null;
      customerPhone: string | null;
      trip: { driverId: string };
    };

    // Le support garde tout ; le client et le conducteur ne voient plus les numéros une fois le trajet terminé.
    if (await this.scope.hasBookingAccess(user, id)) return booking;

    {
      const customer = await this.customerProfilesService.findByUserId(user.id).catch(() => null);
      const isOwningCustomer = customer?.id === booking.customerId;

      let isOwningDriver = false;
      if (!isOwningCustomer) {
        const driverId = await this.driverProfilesService
          .getProfileIdForUser(user.id)
          .catch(() => null);
        isOwningDriver = driverId !== null && driverId === booking.trip.driverId;
      }

      if (!isOwningCustomer && !isOwningDriver) {
        throw new ForbiddenException('Cette réservation ne vous appartient pas.');
      }
      return hideContactsOnceCompleted(booking, isOwningCustomer ? 'customer' : 'driver');
    }
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const customer = await this.customerProfilesService.findByUserId(user.id);
    return this.bookingsService.cancel(id, customer.id, dto.reason);
  }

  /** Le conducteur déclare un client absent au point de rendez-vous (après l'attente minimale) : il est payé, le client n'est pas remboursé. */
  @Post(':id/no-show')
  async declareNoShow(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripCompletion.declareNoShow(id, driverId);
  }

  @Post(':id/otp/pickup/request')
  async requestPickupOtp(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripOtpService.requestPickupOtp(id, driverId);
  }

  /** Pour le passager : revoir son propre code de prise en charge dans l'app plutôt que de rouvrir le SMS. */
  @Post(':id/otp/pickup/reveal-for-customer')
  async revealPickupOtpForCustomer(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customerProfilesService.findByUserId(user.id);
    return this.tripOtpService.revealPickupOtpForCustomer(id, customer.id);
  }

  @Post(':id/otp/pickup/verify')
  async verifyPickupOtp(
    @Param('id') id: string,
    @Body() dto: VerifyCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripOtpService.verifyPickupOtp(id, driverId, dto.code);
  }

  @Post(':id/otp/dropoff/request')
  async requestDropoffOtp(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripOtpService.requestDropoffOtp(id, driverId);
  }

  /** Pour le passager : revoir son propre code de dépose dans l'app plutôt que de rouvrir le SMS. */
  @Post(':id/otp/dropoff/reveal-for-customer')
  async revealDropoffOtpForCustomer(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customerProfilesService.findByUserId(user.id);
    return this.tripOtpService.revealDropoffOtpForCustomer(id, customer.id);
  }

  @Post(':id/otp/dropoff/verify')
  async verifyDropoffOtp(
    @Param('id') id: string,
    @Body() dto: VerifyCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.tripOtpService.verifyDropoffOtp(id, driverId, dto.code);
  }

  @Permissions(PERMISSIONS.BOOKING_READ)
  @Get()
  findAll(@Query() query: ListBookingsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findAll(
      query,
      { status: query.status, tripId: query.tripId },
      this.scope.bookingWhere(user, PERMISSIONS.BOOKING_READ),
    );
  }
}