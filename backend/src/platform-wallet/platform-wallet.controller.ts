// backend/src/platform-wallet/platform-wallet.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { PlatformWalletService } from './platform-wallet.service';
import {
  CreateBeneficiaryDto,
  CreateWithdrawalDto,
  FailWithdrawalDto,
  ListWithdrawalsQueryDto,
  ResolveWithdrawalDto,
  UpdateBeneficiaryDto,
} from './dto/platform-wallet.dto';

@ApiTags('Portefeuille plateforme')
@ApiBearerAuth()
@Controller('platform-wallet')
export class PlatformWalletController {
  constructor(private readonly service: PlatformWalletService) {}

  /** Soldes par devise (XOF, GNF) : gagné, en attente, retiré, en cours, disponible. */
  @Permissions(PERMISSIONS.PLATFORM_WALLET_READ)
  @Get()
  overview() {
    return this.service.getOverview();
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_READ)
  @Get('beneficiaries')
  beneficiaries() {
    return this.service.listBeneficiaries();
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Post('beneficiaries')
  createBeneficiary(@Body() dto: CreateBeneficiaryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createBeneficiary(dto, user.id);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Patch('beneficiaries/:id')
  updateBeneficiary(@Param('id') id: string, @Body() dto: UpdateBeneficiaryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateBeneficiary(id, dto, user.id);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_READ)
  @Get('withdrawals')
  withdrawals(@Query() query: ListWithdrawalsQueryDto) {
    return this.service.listWithdrawals(query);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Post('withdrawals')
  withdraw(@Body() dto: CreateWithdrawalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.withdraw(dto, user.id);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Patch('withdrawals/:id/paid')
  markPaid(@Param('id') id: string, @Body() dto: ResolveWithdrawalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.markPaid(id, dto.externalReference, user.id);
  }

  @Permissions(PERMISSIONS.PLATFORM_WALLET_MANAGE)
  @Patch('withdrawals/:id/failed')
  markFailed(@Param('id') id: string, @Body() dto: FailWithdrawalDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.markFailed(id, dto.reason, user.id);
  }
}
