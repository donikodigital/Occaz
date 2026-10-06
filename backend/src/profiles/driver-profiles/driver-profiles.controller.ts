// backend/src/profiles/driver-profiles/driver-profiles.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { AuthenticatedUser } from '../../common/types/request-with-user.interface';
import { CountryScopeService } from '../../common/scope/country-scope.service';
import { DriverProfilesService } from './driver-profiles.service';
import { CreateDriverProfileDto } from './dto/create-driver-profile.dto';
import { UpdateDriverProfileDto } from './dto/update-driver-profile.dto';
import { SuspendDriverDto } from './dto/suspend-driver.dto';
import { CreateDocumentDto } from '../../documents/dto/create-document.dto';
import { RequestUploadUrlDto } from '../../storage/dto/request-upload-url.dto';
import { ConfirmPhotoDto } from './dto/confirm-photo.dto';
import { ListDriverProfilesQueryDto } from './dto/list-driver-profiles-query.dto';

@ApiTags('Profils — Conducteurs')
@ApiBearerAuth()
@Controller('driver-profiles')
export class DriverProfilesController {
  constructor(
    private readonly driverProfilesService: DriverProfilesService,
    private readonly scope: CountryScopeService,
  ) {}

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

  @Post('me/documents/upload-url')
  requestDocumentUploadUrl(@Body() dto: RequestUploadUrlDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.requestDocumentUploadUrlForUser(user.id, dto);
  }

  @Post('me/documents')
  uploadMyDocument(@Body() dto: CreateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.uploadDocumentForUser(user.id, dto);
  }

  @Get('me/documents')
  findMyDocuments(@CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.findDocumentsForUser(user.id);
  }

  @Post('me/photo/upload-url')
  requestPhotoUploadUrl(@Body() dto: RequestUploadUrlDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.requestPhotoUploadUrlForUser(user.id, dto);
  }

  @Post('me/photo')
  confirmPhoto(@Body() dto: ConfirmPhotoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.confirmPhotoForUser(user.id, dto);
  }

  @Permissions(PERMISSIONS.DRIVER_READ)
  @Get()
  findAll(@Query() query: ListDriverProfilesQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.driverProfilesService.findAll(
      query,
      { status: query.status, countryId: query.countryId },
      this.scope.driverWhere(user, PERMISSIONS.DRIVER_READ),
    );
  }

  @Permissions(PERMISSIONS.DRIVER_READ)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertDriver(user, PERMISSIONS.DRIVER_READ, id);
    return this.driverProfilesService.findOne(id);
  }

  @Permissions(PERMISSIONS.DRIVER_VERIFY)
  @Patch(':id/verify')
  async verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertDriver(user, PERMISSIONS.DRIVER_VERIFY, id);
    return this.driverProfilesService.verify(id, user.id);
  }

  @Permissions(PERMISSIONS.DRIVER_SUSPEND)
  @Patch(':id/suspend')
  async suspend(
    @Param('id') id: string,
    @Body() dto: SuspendDriverDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.assertDriver(user, PERMISSIONS.DRIVER_SUSPEND, id);
    return this.driverProfilesService.suspend(id, dto.reason, user.id);
  }

  @Permissions(PERMISSIONS.DRIVER_SUSPEND)
  @Patch(':id/reactivate')
  async reactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertDriver(user, PERMISSIONS.DRIVER_SUSPEND, id);
    return this.driverProfilesService.reactivate(id, user.id);
  }
}