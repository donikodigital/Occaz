// backend/src/payment-providers/payment-providers.module.ts
import { Module } from '@nestjs/common';
import { PaymentProvidersController } from './payment-providers.controller';
import { PaymentProvidersService } from './payment-providers.service';

@Module({
  controllers: [PaymentProvidersController],
  providers: [PaymentProvidersService],
  exports: [PaymentProvidersService],
})
export class PaymentProvidersModule {}
