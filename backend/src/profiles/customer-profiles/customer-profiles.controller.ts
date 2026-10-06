// backend/src/profiles/customer-profiles/customer-profiles.controller.ts
// [21/09/2026] v+ — routes de photo de profil (upload-url puis confirmation), comme côté conducteur.
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permissions.constants';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../common/types/request-with-user.interface';
import { CountryScopeService } from '../../common/scope/country-scope.service';
import { RequestUploadUrlDto } from '../../storage/dto/request-upload-url.dto';
import { CustomerProfilesService } from './customer-profiles.service';
import { CreateCustomerProfileDto } from './dto/create-customer-profile.dto';
import { UpdateCustomerProfileDto } from './dto/update-customer-profile.dto';
import { ConfirmPhotoDto } from './dto/confirm-photo.dto';

@ApiTags('Profils — Clients')
@ApiBearerAuth()
@Controller('customer-profiles')
export class CustomerProfilesController {
  constructor(
    private readonly customerProfilesService: CustomerProfilesService,
    private readonly scope: CountryScopeService,
  ) {}

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
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('countryId') countryId?: string,
  ) {
    return this.customerProfilesService.findAll(
      query,
      countryId,
      this.scope.customerWhere(user, PERMISSIONS.CUSTOMER_READ),
    );
  }

  @Permissions(PERMISSIONS.CUSTOMER_READ)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertCustomer(user, PERMISSIONS.CUSTOMER_READ, id);
    return this.customerProfilesService.findOne(id);
  }
}