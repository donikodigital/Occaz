// backend/src/account-roles/account-roles.controller.ts
// [19/10/2026] v1 — GET /account/roles : quels profils (client, conducteur) a ce compte ; POST /account/roles/customer : un conducteur ouvre
// son espace passager (code PIN demandé). Pour l'inverse (un client qui devient conducteur), le profil conducteur se crée avec les routes
// existantes de /driver-profiles, avec ses pièces à fournir.
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { AccountRolesService } from './account-roles.service';
import { ActivateCustomerDto } from './dto/activate-customer.dto';

@ApiTags('Compte — profils')
@ApiBearerAuth()
@Controller('account/roles')
export class AccountRolesController {
  constructor(private readonly roles: AccountRolesService) {}

  @Get()
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.roles.rolesOf(user.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('customer')
  @HttpCode(HttpStatus.OK)
  activateCustomer(@Body() dto: ActivateCustomerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.roles.activateCustomer(user.id, dto.pin);
  }
}
