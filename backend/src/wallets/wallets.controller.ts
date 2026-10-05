// backend/src/wallets/wallets.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { CountryScopeService } from '../common/scope/country-scope.service';
import { WalletsService } from './wallets.service';
import { AdjustWalletDto } from './dto/adjust-wallet.dto';
import { DriverProfilesService } from '../profiles/driver-profiles/driver-profiles.service';
import { WalletTransactionsQueryDto } from './dto/wallet-transactions-query.dto';

@ApiTags('Portefeuilles')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly driverProfilesService: DriverProfilesService,
    private readonly scope: CountryScopeService,
  ) {}

  @Get('mine')
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    return this.walletsService.findByDriverId(driverId);
  }

  @Get('mine/transactions')
  async findMyTransactions(
    @Query() query: WalletTransactionsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const driverId = await this.driverProfilesService.getProfileIdForUser(user.id);
    const wallet = await this.walletsService.findByDriverId(driverId);
    return this.walletsService.getTransactionsForDriverView(wallet.id, query);
  }

  @Permissions(PERMISSIONS.WALLET_READ)
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.scope.assertWallet(user, PERMISSIONS.WALLET_READ, id);
    return this.walletsService.findOne(id);
  }

  @Permissions(PERMISSIONS.WALLET_READ)
  @Get(':id/transactions')
  async findTransactions(
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.assertWallet(user, PERMISSIONS.WALLET_READ, id);
    return this.walletsService.getTransactions(id, query);
  }

  @Permissions(PERMISSIONS.WALLET_ADJUST)
  @Post(':driverId/adjust')
  async adjust(
    @Param('driverId') driverId: string,
    @Body() dto: AdjustWalletDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.scope.assertDriver(user, PERMISSIONS.WALLET_ADJUST, driverId);
    return this.walletsService.adjustBalance(driverId, dto.amount, dto.reason, user.id);
  }
}