// backend/src/promo-codes/promo-codes.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CustomerProfilesService } from '../profiles/customer-profiles/customer-profiles.service';
import { PromoCodesService } from './promo-codes.service';
import { UpsertPromoCodeDto } from './dto/upsert-promo-code.dto';
import { ValidatePromoCodeDto } from './dto/validate-promo-code.dto';

@ApiTags('Codes promo')
@ApiBearerAuth()
@Controller('promo-codes')
export class PromoCodesController {
  constructor(
    private readonly promoCodesService: PromoCodesService,
    private readonly customerProfilesService: CustomerProfilesService,
  ) {}

  /** Calcule la réduction sans la consacrer — utilisé par l'écran « Saisir un code promo ». */
  @Post('validate')
  async validate(@Body() dto: ValidatePromoCodeDto, @CurrentUser() user: AuthenticatedUser) {
    const customerId = await this.customerProfilesService.getProfileIdForUser(user.id);
    const result = await this.promoCodesService.validate(customerId, dto);
    return { discountAmount: result.discountAmount.toString(), finalAmount: result.finalAmount.toString() };
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.promoCodesService.findAll(query);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.promoCodesService.findOne(id);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Post()
  create(@Body() dto: UpsertPromoCodeDto) {
    return this.promoCodesService.create(dto);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<UpsertPromoCodeDto>) {
    return this.promoCodesService.update(id, dto);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.promoCodesService.deactivate(id);
  }
}