// backend/src/payment-providers/payment-providers.controller.ts
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

@ApiTags('Paiement — Moyens de paiement')
@ApiBearerAuth()
@Controller('payment-providers')
export class PaymentProvidersController {
  constructor(private readonly paymentProvidersService: PaymentProvidersService) {}

  @Get('active')
  findAllActive(
    @Query('countryId') countryId?: string,
    @Query('type') type?: PaymentProviderType,
  ) {
    return this.paymentProvidersService.findAllActiveForCountry(countryId, type);
  }

  @Permissions(PERMISSIONS.PAYMENT_PROVIDER_MANAGE)
  @Get()
  findAll() {
    return this.paymentProvidersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentProvidersService.findOne(id);
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
