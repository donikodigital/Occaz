// backend/src/shipments/shipments.controller.ts
import { Body, Controller, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType, CancellationInitiator } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { AssignShipmentDto } from './dto/assign-shipment.dto';
import { CancelShipmentDto } from './dto/cancel-shipment.dto';
import { SearchAvailableShipmentsDto } from './dto/search-available-shipments.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ListShipmentsQueryDto } from './dto/list-shipments-query.dto';
import { CreateDocumentDto } from '../documents/dto/create-document.dto';
import { CustomerProfilesService } from '../profiles/customer-profiles/customer-profiles.service';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';
import { ShipmentOtpService } from './shipment-otp.service';

@ApiTags('Envois')
@ApiBearerAuth()
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly customerProfilesService: CustomerProfilesService,
    private readonly driverProfilesService: DriverProfilesService,
    private readonly shipmentOtpService: ShipmentOtpService,
  ) {}

  @Get('mine')
  async findMine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customerProfilesService.findByUserId(user.id);
    return this.shipmentsService.findMineForCustomer(customer.id, query);
  }

  @Get('assigned-to-me')
  async findAssignedToMe(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.shipmentsService.findAllForDriverTrips(driverId, query);
  }

  @Get('available')
  findAvailable(@Query() query: SearchAvailableShipmentsDto) {
    return this.shipmentsService.findAvailable(query);
  }

  @Post()
  async create(@Body() dto: CreateShipmentDto, @CurrentUser() user: AuthenticatedUser) {
    const customer = await this.customerProfilesService.findByUserId(user.id);
    return this.shipmentsService.create(customer.id, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const shipment = (await this.shipmentsService.findOne(id)) as unknown as {
      customerId: string;
      trip: { driverId: string } | null;
    };

    if (!user.permissions.includes(PERMISSIONS.SHIPMENT_READ)) {
      const customer = await this.customerProfilesService.findByUserId(user.id).catch(() => null);
      const isOwningCustomer = customer?.id === shipment.customerId;

      let isOwningDriver = false;
      if (!isOwningCustomer && user.accountType === AccountType.DRIVER && shipment.trip) {
        const driverId = await this.driverProfilesService
          .getProfileIdForUser(user.id)
          .catch(() => null);
        isOwningDriver = driverId !== null && driverId === shipment.trip.driverId;
      }

      if (!isOwningCustomer && !isOwningDriver) {
        throw new ForbiddenException('Cet envoi ne vous appartient pas.');
      }
    }
    return shipment;
  }

  @Post(':id/assign')
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.shipmentsService.assignToTrip(id, dto.tripId, driverId);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelShipmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.accountType === AccountType.DRIVER) {
      const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
      return this.shipmentsService.cancel(id, dto.reason, CancellationInitiator.DRIVER, { driverId });
    }
    const customer = await this.customerProfilesService.findByUserId(user.id);
    return this.shipmentsService.cancel(id, dto.reason, CancellationInitiator.CUSTOMER, {
      customerId: customer.id,
    });
  }

  @Post(':id/documents')
  uploadEvidence(@Param('id') id: string, @Body() dto: CreateDocumentDto) {
    return this.shipmentsService.uploadEvidence(id, dto);
  }

  @Get(':id/documents')
  findEvidence(@Param('id') id: string) {
    return this.shipmentsService.findEvidence(id);
  }

  @Post(':id/pickup-pending')
  async markPickupPending(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.shipmentOtpService.markPickupPending(id, driverId);
  }

  @Post(':id/otp/pickup/request')
  async requestPickupOtp(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.shipmentOtpService.requestPickupOtp(id, driverId);
  }

  @Post(':id/otp/pickup/verify')
  async verifyPickupOtp(
    @Param('id') id: string,
    @Body() dto: VerifyCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.shipmentOtpService.verifyPickupOtp(id, driverId, dto.code);
  }

  @Post(':id/in-transit')
  async markInTransit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.shipmentOtpService.markInTransit(id, driverId);
  }

  @Post(':id/delivery-pending')
  async markDeliveryPending(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.shipmentOtpService.markDeliveryPending(id, driverId);
  }

  @Post(':id/otp/delivery/request')
  async requestDeliveryOtp(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.shipmentOtpService.requestDeliveryOtp(id, driverId);
  }

  @Post(':id/otp/delivery/verify')
  async verifyDeliveryOtp(
    @Param('id') id: string,
    @Body() dto: VerifyCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.shipmentOtpService.verifyDeliveryOtp(id, driverId, dto.code);
  }

  @Permissions(PERMISSIONS.SHIPMENT_READ)
  @Get()
  findAll(@Query() query: ListShipmentsQueryDto) {
    return this.shipmentsService.findAll(query, { status: query.status });
  }
}