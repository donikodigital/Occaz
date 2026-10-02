// backend/src/wallets/payouts.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { PayoutsService } from './payouts.service';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { FailPayoutDto } from './dto/fail-payout.dto';
import { ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';

@ApiTags('Retraits')
@ApiBearerAuth()
@Controller('payouts')
export class PayoutsController {
  constructor(
    private readonly payoutsService: PayoutsService,
    private readonly driverProfilesService: DriverProfilesService,
    private readonly scope: CountryScopeService,
  ) {}

  @Get('mine')
  async findMine(@Query() query: PaginationQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.payoutsService.findMineForDriver(driverId, query);
  }

  @Post()
  async request(@Body() dto: RequestPayoutDto, @CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.payoutsService.request(driverId, dto);
  }

  @Permissions(PERMISSIONS.PAYOUT_MANAGE)
  @Get()
  findAll(@Query() query: ListPayoutsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.payoutsService.findAll(
      query,
      { status: query.status },
      this.scope.payoutWhere(user, PERMISSIONS.PAYOUT_MANAGE),
    );
  }

  @Permissions(PERMISSIONS.PAYOUT_MANAGE)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertPayout(user, PERMISSIONS.PAYOUT_MANAGE, id);
    return this.payoutsService.findOne(id);
  }

  @Permissions(PERMISSIONS.PAYOUT_MANAGE)
  @Patch(':id/processing')
  async markProcessing(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertPayout(user, PERMISSIONS.PAYOUT_MANAGE, id);
    return this.payoutsService.markProcessing(id, user.id);
  }

  @Permissions(PERMISSIONS.PAYOUT_MANAGE)
  @Patch(':id/paid')
  async markPaid(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertPayout(user, PERMISSIONS.PAYOUT_MANAGE, id);
    return this.payoutsService.markPaid(id, user.id);
  }

  @Permissions(PERMISSIONS.PAYOUT_MANAGE)
  @Patch(':id/failed')
  async markFailed(
    @Param('id') id: string,
    @Body() dto: FailPayoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.assertPayout(user, PERMISSIONS.PAYOUT_MANAGE, id);
    return this.payoutsService.markFailed(id, dto.reason, user.id);
  }
}