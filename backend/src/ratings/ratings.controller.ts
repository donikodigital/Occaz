// backend/src/ratings/ratings.controller.ts
import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Notation')
@ApiBearerAuth()
@Controller('ratings')
export class RatingsController {
  constructor(
    private readonly ratingsService: RatingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('mine')
  findMine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.ratingsService.findForUser(user.id, query);
  }

  @Post('bookings/:bookingId')
  rateBooking(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateRatingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ratingsService.rateForBooking(user.id, bookingId, dto);
  }

  @Get('bookings/:bookingId')
  async findForBooking(@Param('bookingId') bookingId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.assertPartyToBookingOrAdmin(bookingId, user);
    return this.ratingsService.findForBooking(bookingId);
  }

  @Post('shipments/:shipmentId')
  rateShipment(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: CreateRatingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ratingsService.rateForShipment(user.id, shipmentId, dto);
  }

  @Get('shipments/:shipmentId')
  async findForShipment(@Param('shipmentId') shipmentId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.assertPartyToShipmentOrAdmin(shipmentId, user);
    return this.ratingsService.findForShipment(shipmentId);
  }

  /** Les avis peuvent contenir des commentaires sensibles — lecture réservée aux parties prenantes ou au support. */
  private async assertPartyToBookingOrAdmin(bookingId: string, user: AuthenticatedUser): Promise<void> {
    if (user.permissions.includes(PERMISSIONS.BOOKING_READ)) return;
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, trip: { include: { driver: true } } },
    });
    const isParty =
      booking?.customer.userId === user.id || booking?.trip.driver.userId === user.id;
    if (!isParty) throw new ForbiddenException('Accès non autorisé à ces notations.');
  }

  private async assertPartyToShipmentOrAdmin(shipmentId: string, user: AuthenticatedUser): Promise<void> {
    if (user.permissions.includes(PERMISSIONS.SHIPMENT_READ)) return;
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { customer: true, trip: { include: { driver: true } } },
    });
    const isParty =
      shipment?.customer.userId === user.id || shipment?.trip?.driver.userId === user.id;
    if (!isParty) throw new ForbiddenException('Accès non autorisé à ces notations.');
  }
}
