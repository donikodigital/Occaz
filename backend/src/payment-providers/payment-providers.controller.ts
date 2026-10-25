// backend/src/payment-providers/payment-providers.controller.ts
// [25/10/2026] v2 — `config` (réglages techniques du prestataire) n'est renvoyé qu'à la gestion des moyens de paiement : la liste publique
// /active et GET /:id n'exposent plus que les champs d'affichage.
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentProviderType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { AuthenticatedUser } from '../common/types/request-with-user.interface';
import { PaymentProvidersService } from './payment-providers.service';
import { CreatePaymentProviderDto } from './dto/create-payment-provider.dto';
import { UpdatePaymentProviderDto } from './dto/update-payment-provider.dto';

/** Retire les réglages techniques du prestataire d'une ligne avant de l'envoyer à un utilisateur sans droit de gestion. */
export function withoutConfig<T extends { config?: unknown }>(provider: T): Omit<T, 'config'> {
  const { config: _config, ...rest } = provider;
  return rest;
}

@ApiTags('Paiement — Moyens de paiement')
@ApiBearerAuth()
@Controller('payment-providers')
export class PaymentProvidersController {
  constructor(private readonly paymentProvidersService: PaymentProvidersService) {}

  @Get('active')
  async findAllActive(
    @Query('countryId') countryId?: string,
    @Query('type') type?: PaymentProviderType,
  ) {
    const providers = await this.paymentProvidersService.findAllActiveForCountry(countryId, type);
    return providers.map(withoutConfig);
  }

  @Permissions(PERMISSIONS.PAYMENT_PROVIDER_MANAGE)
  @Get()
  findAll() {
    return this.paymentProvidersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const provider = await this.paymentProvidersService.findOne(id);
    return user.permissions.includes(PERMISSIONS.PAYMENT_PROVIDER_MANAGE) ? provider : withoutConfig(provider);
  }

  @Permissions(PERMISSIONS.PAYMENT_PROVIDER_MANAGE)
  @Post()
  create(@Body() dto: CreatePaymentProviderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentProvidersService.create(dto, user.id);
  }

  @Permissions(PERMISSIONS.PAYMENT_PROVIDER_MANAGE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentProviderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentProvidersService.update(id, dto, user.id);
  }

  @Permissions(PERMISSIONS.PAYMENT_PROVIDER_MANAGE)
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentProvidersService.deactivate(id, user.id);
  }

  @Permissions(PERMISSIONS.PAYMENT_PROVIDER_MANAGE)
  @Patch(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentProvidersService.activate(id, user.id);
  }
}
