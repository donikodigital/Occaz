// backend/src/profiles/driver-profiles/driver-profiles.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DriverAccountStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/request-with-user.interface';
import { DriverProfilesService } from './driver-profiles.service';
import { CreateDriverProfileDto } from './dto/create-driver-profile.dto';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';
import { SuspendDriverDto } from './dto/suspend-driver.dto';
import { CreateDocumentDto } from '../../documents/dto/create-document.dto';

@ApiTags('Profils — Chauffeurs')
@ApiBearerAuth()
@Controller('driver-profiles')
export class DriverProfilesController {
  constructor(private readonly driverProfilesService: DriverProfilesService) {}

  @Post('me')
  createMine(@Body() dto: CreateDriverProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.createForUser(user.id, user.accountType, dto);
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.findByUserId(user.id);
  }

  @Patch('me')
  updateMine(@Body() dto: UpdateDriverProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.updateForUser(user.id, dto);
  }

  @Post('me/documents')
  uploadMyDocument(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.uploadDocumentForUser(user.id, dto);
  }

  @Get('me/documents')
  findMyDocuments(@CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.findDocumentsForUser(user.id);
  }

  @Permissions(PERMISSIONS.DRIVER_READ)
  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @Query('status') status?: DriverAccountStatus,
    @Query('countryId') countryId?: string,
  ) {
    return this.driverProfilesService.findAll(query, { status, countryId });
  }

  @Permissions(PERMISSIONS.DRIVER_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.driverProfilesService.findOne(id);
  }

  @Permissions(PERMISSIONS.DRIVER_VERIFY)
  @Patch(':id/verify')
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.verify(id, user.id);
  }

  @Permissions(PERMISSIONS.DRIVER_SUSPEND)
  @Patch(':id/suspend')
  suspend(
    @Param('id') id: string,
    @Body() dto: SuspendDriverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.driverProfilesService.suspend(id, dto.reason, user.id);
  }

  @Permissions(PERMISSIONS.DRIVER_SUSPEND)
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.reactivate(id, user.id);
  }
}
