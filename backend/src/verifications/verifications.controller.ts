// backend/src/verifications/verifications.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountType, VerificationStatus, VerificationType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { VerificationsService } from './verifications.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { RejectVerificationDto } from './dto/reject-verification.dto';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';

@ApiTags('Vérifications')
@ApiBearerAuth()
@Controller('verifications')
export class VerificationsController {
  constructor(
    private readonly verificationsService: VerificationsService,
    private readonly driverProfilesService: DriverProfilesService,
  ) {}

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.verificationsService.findAllForUser(user.id);
  }

  @Post()
  async request(@Body() dto: CreateVerificationDto, @CurrentUser() user: AuthenticatedUser) {
    const driverId =
      user.accountType === AccountType.DRIVER
        ? await this.driverProfilesService.getProfileIdForUser(user.id)
        : undefined;
    return this.verificationsService.request(user.id, driverId, dto);
  }

  @Permissions(PERMISSIONS.DRIVER_VERIFY)
  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: VerificationStatus,
    @Query('type') type?: VerificationType,
  ) {
    return this.verificationsService.findAll(query, { status, type });
  }

  @Permissions(PERMISSIONS.DRIVER_VERIFY)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.verificationsService.findOne(id);
  }

  @Permissions(PERMISSIONS.DRIVER_VERIFY)
  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.verificationsService.approve(id, user.id);
  }

  @Permissions(PERMISSIONS.DRIVER_VERIFY)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectVerificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.verificationsService.reject(id, dto.reason, user.id);
  }
}
