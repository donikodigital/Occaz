// backend/src/profiles/customer-profiles/customer-profiles.controller.ts
// [21/09/2026] v+ — routes de photo de profil (upload-url puis confirmation), comme côté chauffeur.
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/request-with-user.interface';
import { RequestUploadUrlDto } from '../../storage/dto/request-upload-url.dto';
import { CustomerProfilesService } from './customer-profiles.service';
import { CreateCustomerProfileDto } from './dto/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { ConfirmPhotoDto } from './dto/confirm-photo.dto';

@ApiTags('Profils — Clients')
@ApiBearerAuth()
@Controller('customer-profiles')
export class CustomerProfilesController {
  constructor(private readonly customerProfilesService: CustomerProfilesService) {}

  @Post('me')
  createMine(@Body() dto: CreateCustomerProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customerProfilesService.createForUser(user.id, user.accountType, dto);
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.customerProfilesService.findByUserId(user.id);
  }

  @Patch('me')
  updateMine(@Body() dto: UpdateCustomerProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customerProfilesService.updateForUser(user.id, dto);
  }

  @Post('me/photo/upload-url')
  requestPhotoUploadUrl(@Body() dto: RequestUploadUrlDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customerProfilesService.requestPhotoUploadUrlForUser(user.id, dto);
  }

  @Post('me/photo')
  confirmPhoto(@Body() dto: ConfirmPhotoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.customerProfilesService.confirmPhotoForUser(user.id, dto);
  }

  @Permissions(PERMISSIONS.CUSTOMER_READ)
  @Get()
  findAll(@Query() query: PaginationQueryDto, @Query('countryId') countryId?: string) {
    return this.customerProfilesService.findAll(query, countryId);
  }

  @Permissions(PERMISSIONS.CUSTOMER_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customerProfilesService.findOne(id);
  }
}