// backend/src/referrals/referrals.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ReferralsService } from './referrals.service';
import { ApplyReferralCodeDto } from './dto/apply-referral-code.dto';
import { CompleteReferralDto } from './dto/complete-referral.dto';

@ApiTags('Parrainage')
@ApiBearerAuth()
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('my-code')
  async myCode(@CurrentUser() user: AuthenticatedUser) {
    return { code: await this.referralsService.getOrCreateMyCode(user.id) };
  }

  @Post('apply')
  apply(@Body() dto: ApplyReferralCodeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.applyCode(user.id, dto.code);
  }

  @Get('mine')
  findMine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.findMine(user.id, query);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.referralsService.findAll(query);
  }

  @Permissions(PERMISSIONS.PROMOTION_MANAGE)
  @Patch(':id/complete')
  complete(@Param('id') id: string, @Body() dto: CompleteReferralDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.complete(id, dto.rewardAmount, user.id);
  }
}