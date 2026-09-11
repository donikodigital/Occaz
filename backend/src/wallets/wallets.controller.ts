// backend/src/wallets/wallets.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { WalletsService } from './wallets.service';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';

@ApiTags('Portefeuilles')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly driverProfilesService: DriverProfilesService,
  ) {}

  @Get('mine')
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.walletsService.findByDriverId(driverId);
  }

  @Get('mine/transactions')
  async findMyTransactions(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    const wallet = await this.walletsService.findByDriverId(driverId);
    return this.walletsService.getTransactions(wallet.id, query);
  }

  @Permissions(PERMISSIONS.WALLET_READ)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.walletsService.findOne(id);
  }

  @Permissions(PERMISSIONS.WALLET_READ)
  @Get(':id/transactions')
  findTransactions(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.walletsService.getTransactions(id, query);
  }

  @Permissions(PERMISSIONS.WALLET_ADJUST)
  @Post(':driverId/adjust')
  adjust(
    @Param('driverId') driverId: string,
    @Body() dto: AdjustWalletDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.walletsService.adjustBalance(driverId, dto.amount, dto.reason, user.id);
  }
}
